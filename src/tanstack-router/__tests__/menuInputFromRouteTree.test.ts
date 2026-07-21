import {
	createRootRoute,
	createRoute,
	createRouter,
} from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { defineMenu } from "../../defineMenu";
import { menuInputFromRouteTree } from "../index";

/** Build an initialized route tree (router init populates `fullPath`). */
function buildTree() {
	const root = createRootRoute();

	const index = createRoute({ getParentRoute: () => root, path: "/" });
	const about = createRoute({ getParentRoute: () => root, path: "about" });
	const button = createRoute({
		getParentRoute: () => root,
		path: "button",
		staticData: { menu: { title: "Button", order: 1 } },
	});
	// Section: a route with a path AND children.
	const components = createRoute({
		getParentRoute: () => root,
		path: "components",
	});
	const componentsBadge = createRoute({
		getParentRoute: () => components,
		path: "badge",
	});

	// Pathless layout: no `path` → transparent, its children attach to the root.
	const layout = createRoute({ getParentRoute: () => root, id: "_layout" });
	const settings = createRoute({
		getParentRoute: () => layout,
		path: "settings",
	});

	const routeTree = root.addChildren([
		index,
		about,
		button,
		components.addChildren([componentsBadge]),
		layout.addChildren([settings]),
	]);

	createRouter({ routeTree });
	return routeTree;
}

describe("menuInputFromRouteTree", () => {
	it("emits a keyed object with `parent` set to the nearest navigable ancestor", () => {
		const input = menuInputFromRouteTree(buildTree());
		expect(input["/components/badge"]?.parent).toBe("/components");
		// Bubbled up from the pathless `_layout` → no parent.
		expect(input["/settings"]?.parent).toBeUndefined();
		expect(input["/"]?.parent).toBeUndefined();
	});

	it("reads title/order from staticData, falls back to a title-cased segment", () => {
		const input = menuInputFromRouteTree(buildTree());
		expect(input["/button"]).toMatchObject({ title: "Button", order: 1 });
		expect(input["/about"]?.title).toBe("About");
	});

	it("`omit`s a route together with its subtree", () => {
		const input = menuInputFromRouteTree(buildTree(), {
			omit: ["/components"],
		});
		expect(input["/components"]).toBeUndefined();
		expect(input["/components/badge"]).toBeUndefined(); // subtree dropped
	});

	it("composes into a nested tree via defineMenu", () => {
		const menu = defineMenu(menuInputFromRouteTree(buildTree()));
		const components = menu.find((i) => i.href === "/components");
		expect(components?.items?.map((i) => i.href)).toEqual([
			"/components/badge",
		]);
		// `id` falls out of the route `fullPath` key.
		expect(components?.id).toBe("/components");
		expect(components?.items?.[0].id).toBe("/components/badge");
		expect(menu.find((i) => i.href === "/_layout")).toBeUndefined();
	});

	it("lets a custom child be injected into a generated section", () => {
		const menu = defineMenu({
			...menuInputFromRouteTree(buildTree()),
			"/changelog": { title: "Changelog", parent: "/components" },
		});
		const components = menu.find((i) => i.href === "/components");
		expect(components?.items?.map((i) => i.href)).toEqual([
			"/components/badge",
			"/changelog",
		]);
	});

	it("honors a custom getRouteMenu", () => {
		const input = menuInputFromRouteTree(buildTree(), {
			getRouteMenu: (route) =>
				route.fullPath === "/about"
					? { title: "Custom About", order: 0 }
					: undefined,
		});
		expect(input["/about"]).toMatchObject({ title: "Custom About", order: 0 });
	});
});
