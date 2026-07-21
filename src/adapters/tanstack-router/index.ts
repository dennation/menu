import type { AnyRoute } from "@tanstack/react-router";
import type { RoutePaths } from "@tanstack/router-core";
import type { ReactNode } from "react";
import type { MenuItemInput } from "../../types";

/**
 * How a route describes itself in a menu, read by the adapter's default
 * `getRouteMenu` from `route.options.staticData.menu`. Composition decisions
 * (excluding, overriding, re-parenting) belong to the authoring layer — `omit`
 * here, keyed override and `parent` in `defineMenu`.
 *
 * ```tsx
 * createFileRoute('/button')({
 *   component: ButtonPage,
 *   staticData: { menu: { title: 'Button', order: 1 } },
 * })
 * ```
 */
export interface RouteMenuEntry<M = never> {
	/** Display title. Falls back to a title-cased last path segment. */
	title?: string;
	/** Sort hint among siblings (lower first). */
	order?: number;
	icon?: ReactNode;
	/** Opaque per-item metadata, carried onto the menu node verbatim. */
	meta?: M;
}

declare module "@tanstack/router-core" {
	interface StaticDataRouteOption {
		// `unknown` meta: a module augmentation can't be generic, so the concrete
		// meta type is applied at the `menuInputFromRouteTree<Tree, M>` call site.
		menu?: RouteMenuEntry<unknown>;
	}
}

export interface MenuInputFromRouteTreeOptions<
	TRouteTree extends AnyRoute,
	M = never,
> {
	/** Route full-paths to exclude (and their subtrees). Typed against the tree. */
	omit?: RoutePaths<TRouteTree>[];
	/** Where the per-route entry lives. Default: `route.options.staticData.menu`. */
	getRouteMenu?: (route: AnyRoute) => RouteMenuEntry<M> | undefined;
}

/**
 * The adapter's return: a {@link MenuItemInput} map keyed by route full-path,
 * with `parent` typed to the tree's route paths. Object spread keeps keys in the
 * type, so `defineMenu` can check `parent` against these paths through a spread.
 */
export type RouteMenuInput<TRouteTree extends AnyRoute, M = never> = Partial<
	Record<RoutePaths<TRouteTree>, MenuItemInput<RoutePaths<TRouteTree>, M>>
>;

/**
 * Build a keyed menu input from a TanStack Router route tree. Each entry is
 * keyed by `fullPath`, with `parent` pointing at the nearest navigable ancestor;
 * spread the result into `defineMenu` to resolve it into a tree:
 *
 * ```tsx
 * const menu = defineMenu({
 *   ...menuInputFromRouteTree(routeTree, { omit: ['/about'] }),
 *   '/changelog': { title: 'Changelog', parent: '/components' },
 *   '/button': { title: 'Button', icon: <Cube /> }, // overrides the generated one
 * })
 * ```
 *
 * The root and pathless/layout routes are transparent — their children attach to
 * the nearest navigable ancestor. Routes in `omit` are dropped with their subtree.
 */
export function menuInputFromRouteTree<TRouteTree extends AnyRoute, M = never>(
	routeTree: TRouteTree,
	options: MenuInputFromRouteTreeOptions<TRouteTree, M> = {},
): RouteMenuInput<TRouteTree, M> {
	const omit = new Set<string>(options.omit ?? []);
	// Typed at `M` for callers; the resolver itself never inspects `meta`, so it
	// works at `unknown` and casts the result back at the end.
	const getRouteMenu = (options.getRouteMenu ?? defaultGetRouteMenu) as (
		route: AnyRoute,
	) => RouteMenuEntry<unknown> | undefined;
	const entries: Record<string, MenuItemInput<string, unknown>> = {};

	const visit = (route: AnyRoute, parentKey: string | undefined): void => {
		let childParentKey = parentKey;

		if (!isTransparent(route)) {
			const { fullPath } = route;
			if (omit.has(fullPath)) return; // drop this route with its subtree
			entries[fullPath] = toEntry(fullPath, parentKey, getRouteMenu(route));
			childParentKey = fullPath;
		}

		for (const child of childrenOf(route)) visit(child, childParentKey);
	};

	visit(routeTree, undefined);
	return entries as unknown as RouteMenuInput<TRouteTree, M>;
}

function toEntry(
	fullPath: string,
	parentKey: string | undefined,
	route: RouteMenuEntry<unknown> | undefined,
): MenuItemInput<string, unknown> {
	return {
		title: route?.title ?? titleFromPath(fullPath),
		...(parentKey != null && { parent: parentKey }),
		...(route?.order != null && { order: route.order }),
		...(route?.icon != null && { icon: route.icon }),
		...(route?.meta !== undefined && { meta: route.meta }),
	};
}

/** A route with no own path (root, pathless layout): its children bubble up. */
function isTransparent(route: AnyRoute): boolean {
	return route.isRoot === true || !route.path;
}

/** Children of a route, normalized to an array (TanStack also allows a record). */
function childrenOf(route: AnyRoute): AnyRoute[] {
	const children = route.children as
		| AnyRoute[]
		| Record<string, AnyRoute>
		| undefined;
	if (!children) return [];
	return Array.isArray(children) ? children : Object.values(children);
}

function defaultGetRouteMenu(
	route: AnyRoute,
): RouteMenuEntry<unknown> | undefined {
	return route.options?.staticData?.menu;
}

/** Title-case the last non-empty segment (`/user-settings` → `User Settings`). */
function titleFromPath(fullPath: string): string {
	const segment = fullPath.split("/").filter(Boolean).at(-1);
	if (!segment) return "Home";
	return segment.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
