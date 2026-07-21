import { describe, expect, it } from "vitest";
import { defineMenu } from "../defineMenu";
import { findMenuItem, findMenuItemBy } from "../findMenuItem";
import { getMenuTrail, getMenuTrailBy } from "../getMenuTrail";

const menu = defineMenu({
	"/": { title: "Home" },
	"/components": { title: "Components" },
	"/components/button": { title: "Button", parent: "/components" },
});

describe("getMenuTrail", () => {
	it("returns the chain from the top level down to the id", () => {
		expect(getMenuTrail(menu, "/components/button").map((i) => i.id)).toEqual([
			"/components",
			"/components/button",
		]);
	});

	it("returns a single item for a top-level id", () => {
		expect(getMenuTrail(menu, "/").map((i) => i.id)).toEqual(["/"]);
	});

	it("returns empty for an unknown id", () => {
		expect(getMenuTrail(menu, "/missing")).toEqual([]);
	});
});

describe("findMenuItem", () => {
	it("finds a nested item", () => {
		expect(findMenuItem(menu, "/components/button")?.title).toBe("Button");
	});

	it("returns undefined for an unknown id", () => {
		expect(findMenuItem(menu, "/missing")).toBeUndefined();
	});
});

describe("by predicate", () => {
	it("getMenuTrailBy returns the branch of the first matching item", () => {
		const trail = getMenuTrailBy(menu, (i) => i.title === "Button");
		expect(trail.map((i) => i.id)).toEqual([
			"/components",
			"/components/button",
		]);
	});

	it("findMenuItemBy returns the first match (pre-order)", () => {
		expect(findMenuItemBy(menu, (i) => i.title === "Button")?.id).toBe(
			"/components/button",
		);
		expect(findMenuItemBy(menu, () => false)).toBeUndefined();
	});
});
