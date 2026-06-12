import type { ComponentType, ReactNode } from "react";
import { Fragment, useState } from "react";
import type { MenuItem, MenuItemState, Menu as MenuModel } from "../types.js";

/** Expanded state for a section that doesn't set `defaultOpen`. */
const DEFAULT_OPEN = true;

/** The single outer shell wrapping the whole menu (the consumer's `<nav>`/`<ul>`). */
export interface MenuContainerProps {
	children: ReactNode;
}

/** Fields every rendered entry receives, collapsible or not. */
interface MenuItemPropsBase {
	item: MenuItem;
	/** Nesting depth of this item: `0` at the top, `+1` per level down. */
	level: number;
}

/**
 * A **collapsible section** — an item with children and `collapsible !== false`.
 * Only this variant carries the disclosure state: `open` and `toggle` are
 * present and **required**, alongside the already-rendered nested level as
 * `children`. The consumer still owns the link/icon/active state (its router).
 */
export interface CollapsibleMenuItemProps extends MenuItemPropsBase {
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
 * group header (`collapsible: false`, `children` present and always shown).
 * There is nothing to toggle, so `open`/`toggle` are absent from the type.
 */
export interface StaticMenuItemProps extends MenuItemPropsBase {
	collapsible: false;
	/** The rendered nested level for an always-open group; absent for a leaf. */
	children?: ReactNode;
}

/** Discriminated on `collapsible`: only the collapsible variant has `open`/`toggle`. */
export type MenuItemProps = CollapsibleMenuItemProps | StaticMenuItemProps;

/** The consumer-supplied components the menu renders through. */
export interface MenuComponents {
	Container: ComponentType<MenuContainerProps>;
	Item: ComponentType<MenuItemProps>;
}

export interface MenuProps {
	menu: MenuModel;
	components: MenuComponents;
}

/**
 * Router-agnostic sidebar/nav renderer. Owns the open/closed state of
 * collapsible sections, the recursion, and the `before`/`after` slots (rendered
 * as the `Item`'s direct siblings, no wrapper). It knows nothing about the
 * current path or active state — that lives entirely in the consumer's `Item`
 * (which asks its own router).
 *
 * `Container` is the single outer shell wrapping the whole menu; nested levels
 * are rendered as a bare list of `Item`s and handed to the parent `Item` as
 * `children`, so the per-level wrapper (e.g. a nested `<ul>`) is the `Item`'s
 * own concern.
 *
 * Collapsibility is data-driven: an item with children is collapsible unless it
 * sets `collapsible: false` (an always-open group). The `Item` is handed the
 * matching prop variant, so `open`/`toggle` only exist where they mean something.
 */
export function Menu({ menu, components: { Container, Item } }: MenuProps) {
	// Disclosure state of collapsible sections, keyed by position path ("0.2.1").
	// Kept above the tree so a section remembers its state even while collapsed.
	const [openByPath, setOpenByPath] = useState<Record<string, boolean>>({});

	const toggle = (path: string, item: MenuItem): void =>
		setOpenByPath((state) => ({
			...state,
			[path]: !(state[path] ?? item.defaultOpen ?? DEFAULT_OPEN),
		}));

	function renderLevel(
		items: MenuModel,
		parentPath: string,
		level: number,
	): ReactNode {
		return items.map((item, index) => {
			const path = parentPath === "" ? String(index) : `${parentPath}.${index}`;
			const childItems = item.items ?? [];
			const hasChildren = childItems.length > 0;
			const isCollapsible = hasChildren && item.collapsible !== false;
			const children = hasChildren
				? renderLevel(childItems, path, level + 1)
				: undefined;
			// A collapsible section follows its toggle; a static group is always
			// open; a leaf has nothing to open.
			const open = isCollapsible
				? (openByPath[path] ?? item.defaultOpen ?? DEFAULT_OPEN)
				: hasChildren;
			const slotState: MenuItemState = { open, level };

			return (
				<Fragment key={path}>
					{item.before?.(item, slotState)}
					{isCollapsible ? (
						<Item
							collapsible
							item={item}
							level={level}
							open={open}
							toggle={() => toggle(path, item)}
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

	return <Container>{renderLevel(menu, "", 0)}</Container>;
}
