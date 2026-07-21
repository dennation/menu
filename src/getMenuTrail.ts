import type { Menu, MenuItem } from "./types";

/** A test applied to an item during a tree walk. */
export type MenuItemPredicate<M = never> = (item: MenuItem<M>) => boolean;

/**
 * The chain of items from the top level down to the first one matching
 * `predicate`, inclusive: for a match on `/components/button` →
 * `[Components, Button]`. Empty if nothing matches.
 *
 * This is both the breadcrumb trail and the set of ancestors to expand for an
 * active item — `useMenu` uses it to open the branch of the active item.
 */
export function getMenuTrailBy<M = never>(
	menu: Menu<M>,
	predicate: MenuItemPredicate<M>,
): MenuItem<M>[] {
	for (const item of menu) {
		if (predicate(item)) return [item];
		if (item.items) {
			const below = getMenuTrailBy(item.items, predicate);
			if (below.length) return [item, ...below];
		}
	}
	return [];
}

/** {@link getMenuTrailBy} for the common case of an exact `id` match. */
export function getMenuTrail<M = never>(
	menu: Menu<M>,
	id: string,
): MenuItem<M>[] {
	return getMenuTrailBy(menu, (item) => item.id === id);
}
