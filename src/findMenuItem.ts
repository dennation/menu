import {
	getMenuTrail,
	getMenuTrailBy,
	type MenuItemPredicate,
} from "./getMenuTrail";
import type { Menu, MenuItem } from "./types";

/**
 * The first item (pre-order) matching `predicate`, or `undefined` — the tail of
 * its trail, so the two share one traversal. Use it to resolve an item by any
 * condition (router match, role, flag) and feed its `id` to `useMenu.setActive`.
 * "First match" like `Array.find`: for prefix/most-specific resolution, make the
 * predicate select exactly one item.
 */
export function findMenuItemBy<M = never>(
	menu: Menu<M>,
	predicate: MenuItemPredicate<M>,
): MenuItem<M> | undefined {
	return getMenuTrailBy(menu, predicate).at(-1);
}

/** {@link findMenuItemBy} for the common case of an exact `id` match. */
export function findMenuItem<M = never>(
	menu: Menu<M>,
	id: string,
): MenuItem<M> | undefined {
	return getMenuTrail(menu, id).at(-1);
}
