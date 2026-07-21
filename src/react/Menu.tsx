import type { ComponentType, ReactNode } from "react";
import {
	createContext,
	memo,
	useCallback,
	useContext,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import type { MenuItem, Menu as MenuModel } from "../types";
import { createMenuStateStore, type MenuStateStore } from "./menuStateStore";

/** Expanded state for a section that doesn't set `defaultOpen`. */
const DEFAULT_OPEN = true;

/** State of the item a slot renders next to (mirrors the `Item` props). */
export interface MenuItemState {
	/** Nesting depth: `0` at the top, `+1` per level down. */
	level: number;
	/** The item's nested `items` are expanded. */
	open: boolean;
	/** Whether this is the active item. */
	isActive: boolean;
	/** Whether the active item is somewhere in this item's subtree. */
	containsActive: boolean;
}

/**
 * Props a `renderBeforeItem`/`renderAfterItem` slot component receives: the
 * `item` plus its {@link MenuItemState} — no `toggle`/`children`, a slot renders
 * *next to* the item, it doesn't control or contain it.
 */
export interface MenuSlotProps<M = never> extends MenuItemState {
	item: MenuItem<M>;
}

/** Fields every rendered entry receives, collapsible or not. */
interface MenuItemPropsBase<M = never> {
	item: MenuItem<M>;
	/** Nesting depth of this item: `0` at the top, `+1` per level down. */
	level: number;
	/** Whether this is the active item (from `useMenu`'s `setActive`). */
	isActive: boolean;
	/** Whether the active item is somewhere in this item's subtree (any depth). */
	containsActive: boolean;
}

/**
 * A **collapsible section** — an item with children and `collapsible !== false`.
 * Only this variant carries the disclosure state.
 */
export interface CollapsibleMenuItemProps<M = never>
	extends MenuItemPropsBase<M> {
	collapsible: true;
	/** This section's expanded state. */
	open: boolean;
	/** Flip this section's expanded state. */
	toggle: () => void;
	/** The rendered nested level. */
	children: ReactNode;
}

/**
 * A **non-collapsible entry** — a leaf link (no `children`) or an always-open
 * group header (`collapsible: false`). Nothing to toggle, so `open`/`toggle`
 * are absent from the type.
 */
export interface StaticMenuItemProps<M = never> extends MenuItemPropsBase<M> {
	collapsible: false;
	/** The rendered nested level for an always-open group; absent for a leaf. */
	children?: ReactNode;
}

/** Discriminated on `collapsible`: only that variant has `open`/`toggle`. */
export type MenuItemProps<M = never> =
	| CollapsibleMenuItemProps<M>
	| StaticMenuItemProps<M>;

/**
 * The {@link MenuItemProps} for a given menu, inferring `M` from it — so an
 * `Item` typed as `MenuItemPropsOf<typeof menu>` doesn't repeat the meta type.
 */
export type MenuItemPropsOf<T> =
	T extends MenuModel<infer M> ? MenuItemProps<M> : never;

/**
 * Disclosure state: `id → open/closed`, overriding the item's `defaultOpen`. A
 * sparse map of overrides — absent ids fall back to `defaultOpen`.
 */
export type MenuOpenState = Record<string, boolean>;

export interface MenuProps<M = never> {
	menu: MenuModel<M>;
	/** Component each entry renders through — a component (not a render fn) so it can use hooks. */
	renderItem: ComponentType<MenuItemProps<M>>;
	/** Wrap the rendered items in your own shell (`<nav>`, `<ul>`, search, footer). */
	children: (items: ReactNode) => ReactNode;
	/** Component rendered before each item (a divider, a group heading). */
	renderBeforeItem?: ComponentType<MenuSlotProps<M>>;
	/** Component rendered after each item. */
	renderAfterItem?: ComponentType<MenuSlotProps<M>>;
	/**
	 * Disclosure store from `useMenu`. Omit to let `<Menu>` own the state
	 * internally (seeded by `defaultOpen`), for a simple menu with no hook.
	 */
	store?: MenuStateStore;
	/** Initial disclosure state when `<Menu>` owns it (no `store`). */
	defaultOpen?: MenuOpenState;
	/** Notified with the next state on every toggle — for persistence. */
	onOpenChange?: (next: MenuOpenState) => void;
}

/** Stable-identity context for the nodes, so they aren't passed memo-busting props. */
interface MenuContextValue {
	store: MenuStateStore;
	renderItem: ComponentType<MenuItemProps<unknown>>;
	renderBeforeItem?: ComponentType<MenuSlotProps<unknown>>;
	renderAfterItem?: ComponentType<MenuSlotProps<unknown>>;
}

const MenuContext = createContext<MenuContextValue | null>(null);

function useMenuContext(): MenuContextValue {
	const ctx = useContext(MenuContext);
	if (!ctx) throw new Error("A menu node must be rendered inside <Menu>.");
	return ctx;
}

/**
 * One entry, memoized and subscribed to only its own open value, rendering its
 * own children — so a toggle re-renders just the toggled node, not its siblings.
 */
const MenuNode = memo(function MenuNode({
	item,
	level,
}: {
	item: MenuItem<unknown>;
	level: number;
}) {
	const {
		store,
		renderItem: Item,
		renderBeforeItem: Before,
		renderAfterItem: After,
	} = useMenuContext();
	const childItems = item.items ?? [];
	const hasChildren = childItems.length > 0;
	const isCollapsible = hasChildren && item.collapsible !== false;
	const openFallback = item.defaultOpen ?? DEFAULT_OPEN;

	// Collapsible reads the store; a static group is always open; a leaf, never.
	const getOpen = useCallback(
		() => (isCollapsible ? store.isOpen(item.id, openFallback) : hasChildren),
		[store, item.id, isCollapsible, hasChildren, openFallback],
	);
	const open = useSyncExternalStore(store.subscribe, getOpen);

	// Only the old and new active items change this snapshot, so a navigation
	// re-renders just those two nodes.
	const getIsActive = useCallback(
		() => store.isActive(item.id),
		[store, item.id],
	);
	const isActive = useSyncExternalStore(store.subscribe, getIsActive);

	// True for the ancestors of the active item — only the two branches (old and
	// new) change on a navigation.
	const getContainsActive = useCallback(
		() => store.containsActive(item.id),
		[store, item.id],
	);
	const containsActive = useSyncExternalStore(
		store.subscribe,
		getContainsActive,
	);

	const handleToggle = useCallback(
		() => store.toggle(item.id, openFallback),
		[store, item.id, openFallback],
	);

	const children = hasChildren
		? childItems.map((child) => (
				<MenuNode key={child.id} item={child} level={level + 1} />
			))
		: undefined;
	const slotState: MenuItemState = { level, open, isActive, containsActive };
	// Only a collapsible section carries open/toggle; a leaf/static group doesn't.
	const variant = isCollapsible
		? { collapsible: true as const, open, toggle: handleToggle }
		: { collapsible: false as const };

	return (
		<>
			{Before && <Before item={item} {...slotState} />}
			<Item
				item={item}
				level={level}
				isActive={isActive}
				containsActive={containsActive}
				{...variant}
			>
				{children}
			</Item>
			{After && <After item={item} {...slotState} />}
		</>
	);
});

/**
 * Router-agnostic sidebar/nav renderer: owns recursion and the
 * `renderBeforeItem`/`renderAfterItem` slots, renders each entry through
 * `renderItem`. The render-prop `children` wraps the items in your own shell.
 * Pass a `store` from `useMenu` to share the disclosure and active state, or omit
 * it and `<Menu>` owns one, seeded from `defaultOpen`.
 */
export function Menu<M = never>({
	menu,
	renderItem,
	renderBeforeItem,
	renderAfterItem,
	children,
	store: externalStore,
	defaultOpen,
	onOpenChange,
}: MenuProps<M>) {
	// A ref keeps the persistence callback fresh without recreating the store.
	const onChange = useRef(onOpenChange);
	onChange.current = onOpenChange;
	const [ownStore] = useState(() =>
		createMenuStateStore(defaultOpen ?? {}, (next) => onChange.current?.(next)),
	);
	const store = externalStore ?? ownStore;

	const context = useMemo<MenuContextValue>(
		() => ({
			store,
			renderItem: renderItem as ComponentType<MenuItemProps<unknown>>,
			renderBeforeItem: renderBeforeItem as
				| ComponentType<MenuSlotProps<unknown>>
				| undefined,
			renderAfterItem: renderAfterItem as
				| ComponentType<MenuSlotProps<unknown>>
				| undefined,
		}),
		[store, renderItem, renderBeforeItem, renderAfterItem],
	);

	return (
		<MenuContext.Provider value={context}>
			{children(
				menu.map((item) => (
					<MenuNode key={item.id} item={item as MenuItem<unknown>} level={0} />
				)),
			)}
		</MenuContext.Provider>
	);
}
