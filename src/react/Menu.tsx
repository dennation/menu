import type { ComponentType, ReactNode } from "react";
import { Fragment, useState } from "react";
import type { MenuItem, MenuItemState, Menu as MenuModel } from "../types";

/** Expanded state for a section that doesn't set `defaultOpen`. */
const DEFAULT_OPEN = true;

/** The single outer shell wrapping the whole menu (the consumer's `<nav>`/`<ul>`). */
export interface MenuContainerProps {
	children: ReactNode;
}

/** Fields every rendered entry receives, collapsible or not. */
interface MenuItemPropsBase<M = never> {
	item: MenuItem<M>;
	/** Nesting depth of this item: `0` at the top, `+1` per level down. */
	level: number;
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

/** The consumer-supplied components the menu renders through. */
export interface MenuComponents<M = never> {
	Container: ComponentType<MenuContainerProps>;
	Item: ComponentType<MenuItemProps<M>>;
}

export interface MenuProps<M = never> {
	menu: MenuModel<M>;
	components: MenuComponents<M>;
}

/**
 * Router-agnostic sidebar/nav renderer. Owns the disclosure state of collapsible
 * sections, the recursion, and the `before`/`after` slots (rendered as the
 * `Item`'s direct siblings, no wrapper). It knows nothing about the current path
 * — active state lives in the consumer's `Item`, which asks its own router.
 *
 * `Container` is the single outer shell; a nested level is rendered as a bare
 * list of `Item`s and handed to the parent `Item` as `children`, so the
 * per-level wrapper (e.g. a nested `<ul>`) is the `Item`'s own concern.
 *
 * Collapsibility is data-driven: an item with children is collapsible unless it
 * sets `collapsible: false`, and the `Item` gets the matching prop variant.
 */
export function Menu<M = never>({
	menu,
	components: { Container, Item },
}: MenuProps<M>) {
	// Disclosure state of collapsible sections, keyed by the item's stable `id`.
	// Kept above the tree so a section remembers its state while collapsed, and
	// survives reordering/filtering (a position path would not).
	const [openById, setOpenById] = useState<Record<string, boolean>>({});

	const isOpen = (item: MenuItem<M>): boolean =>
		openById[item.id] ?? item.defaultOpen ?? DEFAULT_OPEN;

	const toggle = (item: MenuItem<M>): void =>
		setOpenById((state) => ({ ...state, [item.id]: !isOpen(item) }));

	function renderLevel(items: MenuModel<M>, level: number): ReactNode {
		return items.map((item) => {
			const childItems = item.items ?? [];
			const hasChildren = childItems.length > 0;
			const isCollapsible = hasChildren && item.collapsible !== false;
			const children = hasChildren
				? renderLevel(childItems, level + 1)
				: undefined;
			// A collapsible section follows its toggle; a static group is always
			// open; a leaf has nothing to open.
			const open = isCollapsible ? isOpen(item) : hasChildren;
			const slotState: MenuItemState = { open, level };

			return (
				<Fragment key={item.id}>
					{item.before?.(item, slotState)}
					{isCollapsible ? (
						<Item
							collapsible
							item={item}
							level={level}
							open={open}
							toggle={() => toggle(item)}
						>
							{children}
						</Item>
					) : (
						<Item collapsible={false} item={item} level={level}>
							{children}
						</Item>
					)}
					{item.after?.(item, slotState)}
				</Fragment>
			);
		});
	}

	return <Container>{renderLevel(menu, 0)}</Container>;
}
