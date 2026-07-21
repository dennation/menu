import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { defineMenu } from "../../defineMenu";
import { useMenu } from "../useMenu";

afterEach(cleanup);

const menu = defineMenu({
	"/": { title: "Home" },
	"/components": { title: "Components" },
	"/components/button": { title: "Button", parent: "/components" },
});

describe("useMenu", () => {
	it("derives the trail and active item from defaultActiveId", () => {
		const { result } = renderHook(() =>
			useMenu(menu, { defaultActiveId: "/components/button" }),
		);
		expect(result.current.trail.map((i) => i.id)).toEqual([
			"/components",
			"/components/button",
		]);
		expect(result.current.activeItem?.title).toBe("Button");
		expect(result.current.activeId).toBe("/components/button");
	});

	it("auto-expands the active branch", () => {
		const { result } = renderHook(() =>
			useMenu(menu, { defaultActiveId: "/components/button" }),
		);
		// fallback=false, so this is true only if the branch was *explicitly*
		// opened by the effect — not because sections default to open.
		expect(result.current.menuProps.store?.isOpen("/components", false)).toBe(
			true,
		);
	});

	it("re-expands when the active item changes via setActive", () => {
		const { result } = renderHook(() => useMenu(menu));
		expect(result.current.menuProps.store?.isOpen("/components", false)).toBe(
			false,
		);

		act(() => result.current.setActive("/components/button"));
		expect(result.current.activeItem?.title).toBe("Button");
		expect(result.current.menuProps.store?.isOpen("/components", false)).toBe(
			true,
		);
	});

	it("clears the active item with setActive(undefined)", () => {
		const { result } = renderHook(() =>
			useMenu(menu, { defaultActiveId: "/components/button" }),
		);
		expect(result.current.activeItem?.title).toBe("Button");

		act(() => result.current.setActive(undefined));
		expect(result.current.activeItem).toBeUndefined();
		expect(result.current.activeId).toBeUndefined();
		expect(result.current.trail).toEqual([]);
	});

	it("opens, closes and toggles a section (each step a real transition)", () => {
		const { result } = renderHook(() => useMenu(menu));
		// /components is default-open; close first so every step below flips it.
		act(() => result.current.close("/components"));
		expect(result.current.isOpen("/components")).toBe(false);

		act(() => result.current.open("/components"));
		expect(result.current.isOpen("/components")).toBe(true);

		act(() => result.current.toggle("/components"));
		expect(result.current.isOpen("/components")).toBe(false);

		act(() => result.current.toggle("/components"));
		expect(result.current.isOpen("/components")).toBe(true);
	});

	it("notifies subscribeOpenState on change and stops after unsubscribe", () => {
		const seen: Array<Record<string, boolean>> = [];
		const { result } = renderHook(() => useMenu(menu));

		let unsubscribe = () => {};
		act(() => {
			unsubscribe = result.current.subscribeOpenState((open) =>
				seen.push(open),
			);
		});

		act(() => result.current.close("/components"));
		expect(seen).toEqual([{ "/components": false }]);

		act(() => unsubscribe());
		act(() => result.current.open("/components"));
		expect(seen).toHaveLength(1); // no further notifications
	});

	it("does not re-render the caller on toggle (state lives in the store)", () => {
		let renders = 0;
		const { result } = renderHook(() => {
			renders++;
			return useMenu(menu);
		});
		const before = renders;

		act(() => result.current.toggle("/components"));
		// The store changed, menu nodes will re-render — but the hook's caller
		// does not (no React state here).
		expect(renders).toBe(before);
	});
});
