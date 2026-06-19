import type { AnyRoute } from "@tanstack/react-router";
import type { RoutePaths } from "@tanstack/router-core";
import type { ReactNode } from "react";
import type { MenuItemInput } from "../types";

/**
 * Per-route menu metadata: how the route *describes itself* in a menu. Read by
 * the adapter's default `getMeta` from `route.options.staticData.menu.meta`.
 * Composition decisions (excluding/overriding/ordering entries) belong to the
 * menu-authoring layer (`omit` here, keyed override / `parent` in `defineMenu`),
 * not here. Augment your route definitions:
 *
 * ```tsx
 * createFileRoute('/button')({
 *   component: ButtonPage,
 *   staticData: { menu: { meta: { title: 'Button', order: 1 } } },
 * })
 * ```
 */
export interface RouteMenuMeta<M = never> {
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
		menu?: { meta?: RouteMenuMeta };
	}
}

export interface MenuFromRouteTreeOptions<
	TRouteTree extends AnyRoute,
	M = never,
> {
	/** Route full-paths to exclude (and their subtrees). Typed against the tree. */
	omit?: RoutePaths<TRouteTree>[];
	/**
	 * Where per-route metadata lives. Default reads
	 * `route.options.staticData?.menu?.meta`. Returning a typed
	 * {@link RouteMenuMeta} infers `M` for the generated input.
	 */
	getMeta?: (route: AnyRoute) => RouteMenuMeta<M> | undefined;
}

/**
 * The adapter's return: a {@link MenuItemInput} map keyed by route full-path,
 * with each value's `parent` typed to the tree's route paths. Because object
 * spread keeps keys in the type, `defineMenu` can type `parent` against these
 * paths through the spread — no phantom brand needed.
 */
export type RouteMenuInput<TRouteTree extends AnyRoute, M = never> = Partial<
	Record<RoutePaths<TRouteTree>, MenuItemInput<RoutePaths<TRouteTree>, M>>
>;

/**
 * Build a keyed menu input from a TanStack Router route tree. Each entry is
 * keyed by `fullPath`, with `parent` pointing at the nearest navigable ancestor.
 * Spread the result into {@link defineMenu}, where `parent` is resolved into a
 * tree, sorted by `order`, and keyed overrides are applied:
 *
 * ```tsx
 * const menu = defineMenu({
 *   ...menuFromRouteTree(routeTree, { omit: ['/about'] }),
 *   // add a custom child into a generated section — `parent` is typed to the routes:
 *   '/changelog': { title: 'Changelog', parent: '/components' },
 *   '/button': { title: 'Button', icon: <Cube /> }, // overrides the generated /button
 * })
 * ```
 *
 * Traversal rules:
 * - the root and pathless/layout routes (no `path`) are transparent — their
 *   children attach to the nearest navigable ancestor (or the top level);
 * - a route with a `path` becomes an entry keyed by `fullPath`;
 * - routes in `omit` are dropped together with their subtree;
 * - `title` resolves to `meta.title` ?? title-cased last segment; `order`/`icon`
 *   come from `meta`.
 */
export function menuFromRouteTree<TRouteTree extends AnyRoute, M = never>(
	routeTree: TRouteTree,
	options: MenuFromRouteTreeOptions<TRouteTree, M> = {},
): RouteMenuInput<TRouteTree, M> {
	const omit = new Set<string>(options.omit ?? []);
	// `getMeta` is typed at `M` for callers; the resolver itself works at
	// `unknown` meta (it never inspects the value) and casts the result at the end.
	const getMeta = (options.getMeta ?? defaultGetMeta) as (
		route: AnyRoute,
	) => RouteMenuMeta<unknown> | undefined;
	const entries: Record<string, MenuItemInput<string, unknown>> = {};

	const visit = (
		route: AnyRoute,
		parentHref: string | undefined,
		omitted: boolean,
	): void => {
		let childParentHref = parentHref;
		let childOmitted = omitted;

		if (!isTransparent(route)) {
			const fullPath = fullPathOf(route);
			if (omit.has(fullPath)) {
				childOmitted = true; // drop this route and its subtree
			} else if (!omitted) {
				entries[fullPath] = toEntry(fullPath, parentHref, getMeta(route));
				childParentHref = fullPath;
			}
		}

		for (const child of childrenOf(route))
			visit(child, childParentHref, childOmitted);
	};

	visit(routeTree, undefined, false);
	return entries as unknown as RouteMenuInput<TRouteTree, M>;
}

/** Build the menu entry for a navigable route. */
function toEntry(
	fullPath: string,
	parentHref: string | undefined,
	meta: RouteMenuMeta<unknown> | undefined,
): MenuItemInput<string, unknown> {
	return {
		title: meta?.title ?? titleFromPath(fullPath),
		...(parentHref != null && { parent: parentHref }),
		...(meta?.order != null && { order: meta.order }),
		...(meta?.icon != null && { icon: meta.icon }),
		...(meta?.meta !== undefined && { meta: meta.meta }),
	};
}

/** A route with no own path (root, pathless layout): its children bubble up. */
function isTransparent(route: AnyRoute): boolean {
	const isRoot = (route as { isRoot?: boolean }).isRoot === true;
	const path = (route as { path?: string }).path;
	return isRoot || path == null || path === "";
}

function fullPathOf(route: AnyRoute): string {
	return (route as { fullPath: string }).fullPath;
}

/** Children of a route, normalized to an array (TanStack may store a record). */
function childrenOf(route: AnyRoute): AnyRoute[] {
	const children = (route as { children?: unknown }).children;
	if (!children) return [];
	return Array.isArray(children)
		? children
		: Object.values(children as Record<string, AnyRoute>);
}

function defaultGetMeta(route: AnyRoute): RouteMenuMeta | undefined {
	const staticData = route.options?.staticData as
		| { menu?: { meta?: RouteMenuMeta } }
		| undefined;
	return staticData?.menu?.meta;
}

/** Title-case the last non-empty segment of a path (`/user-settings` → `User Settings`). */
function titleFromPath(fullPath: string): string {
	const segment = fullPath.split("/").filter(Boolean).at(-1);
	if (!segment) return "Home";
	return segment.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
