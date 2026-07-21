import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useSyncExternalStore,
} from "react";
import { findMenuItem } from "../findMenuItem";
import { getMenuTrail } from "../getMenuTrail";
import type { Menu, MenuItem } from "../types";
import type { MenuOpenState, MenuProps } from "./Menu";
import { createMenuStateStore, type MenuStateStore } from "./menuStateStore";

export interface UseMenuOptions {
	/** Initial active item id — its ancestor branch is expanded. */
	defaultActiveId?: string;
	/** Initial disclosure state (id → open/closed). */
	defaultOpen?: MenuOpenState;
}

export interface UseMenuReturn<M = never> {
	/** Spread into `<Menu>` — binds the shared disclosure store. */
	menuProps: Pick<MenuProps<M>, "menu" | "store">;
	/** The active item's id, or `undefined`. */
	activeId: string | undefined;
	/** The active item, or `undefined`. */
	activeItem: MenuItem<M> | undefined;
	/** Set the active item by id; expands its branch. Pass `undefined` to clear. */
	setActive: (id: string | undefined) => void;
	/** Items from the top level down to the active item, inclusive (breadcrumbs). */
	trail: MenuItem<M>[];
	isOpen: (id: string) => boolean;
	open: (id: string) => void;
	close: (id: string) => void;
	toggle: (id: string) => void;
	/**
	 * Subscribe to disclosure-state changes; returns an unsubscribe. The listener
	 * gets the next state and does not re-render the caller — for persistence,
	 * analytics, or syncing elsewhere.
	 */
	subscribeOpenState: (listener: (open: MenuOpenState) => void) => () => void;
}

/**
 * Owns a menu's active item and disclosure state, RHF-style. Set the active item
 * by id — however you resolve it (exact path, prefix, router match, a click) —
 * and the hook expands its branch and gives you `trail`/`activeItem` for
 * breadcrumbs. Spread `menuProps` into `<Menu>`; drive sections with
 * `open`/`close`/`toggle`.
 *
 * Disclosure state lives in a store (not React state), so a toggle re-renders
 * only the affected nodes, not the caller; changing the active item does.
 */
export function useMenu<M = never>(
	menu: Menu<M>,
	options: UseMenuOptions = {},
): UseMenuReturn<M> {
	const { defaultActiveId, defaultOpen } = options;

	const storeRef = useRef<MenuStateStore | null>(null);
	if (storeRef.current === null) {
		const store = createMenuStateStore(defaultOpen ?? {});
		if (defaultActiveId) store.setActive(defaultActiveId);
		storeRef.current = store;
	}
	const store = storeRef.current;

	// The active id lives in the store (so nodes read it per-node); mirror it
	// here reactively for `trail`/`activeItem`.
	const activeId = useSyncExternalStore(store.subscribe, store.getActiveId);

	const trail = useMemo(
		() => (activeId ? getMenuTrail(menu, activeId) : []),
		[menu, activeId],
	);

	// When the active branch changes, expand it and publish its ancestor ids
	// (so nodes can read `containsActive`).
	useEffect(() => {
		store.setActiveAncestors(trail.slice(0, -1).map((item) => item.id));
		if (trail.length === 0) return;
		const patch: MenuOpenState = {};
		for (const item of trail) patch[item.id] = true;
		store.merge(patch);
	}, [trail, store]);

	const fallback = useCallback(
		(id: string) => findMenuItem(menu, id)?.defaultOpen ?? true,
		[menu],
	);

	const isOpen = useCallback(
		(id: string) => store.isOpen(id, fallback(id)),
		[store, fallback],
	);
	const open = useCallback((id: string) => store.set(id, true), [store]);
	const close = useCallback((id: string) => store.set(id, false), [store]);
	const toggle = useCallback(
		(id: string) => store.toggle(id, fallback(id)),
		[store, fallback],
	);
	const setActive = useCallback(
		(id: string | undefined) => store.setActive(id),
		[store],
	);
	const subscribeOpenState = useCallback(
		(listener: (open: MenuOpenState) => void) =>
			store.subscribe(() => listener(store.getState())),
		[store],
	);

	const menuProps = useMemo(() => ({ menu, store }), [menu, store]);

	return {
		menuProps,
		activeId,
		activeItem: trail.at(-1),
		setActive,
		trail,
		isOpen,
		open,
		close,
		toggle,
		subscribeOpenState,
	};
}
