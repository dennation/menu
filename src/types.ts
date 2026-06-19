import type { ReactNode } from "react";

/** State passed to a {@link MenuSlot} for the item being rendered. */
export interface MenuItemState {
	/** The item's nested `items` are expanded. */
	open: boolean;
	/** Nesting depth of the item: `0` at the top, `+1` per level down. */
	level: number;
}

/** Render custom JSX before/after a menu item (e.g. a divider or section heading). */
export type MenuSlot<M = never> = (
	item: MenuItem<M>,
	state: MenuItemState,
) => ReactNode;

/**
 * The opaque per-item metadata field, computed from `M` — the meta type. `M`
 * defaults to `never`: a menu with no meta type has **no usable `meta`** (it's
 * `undefined`). Give a shape (`defineMenu<MyMeta>(…)`, `MenuComponents<MyMeta>`)
 * and the field becomes typed `M` — and, on the **output** node, **required**, so
 * the consumer's `Item` reads `item.meta.x` with no optional chaining.
 *
 * `[M]` wrappers stop the conditional from distributing over a union `M`.
 */
type OutputMeta<M> = [M] extends [never] ? { meta?: undefined } : { meta: M };
/** Like {@link OutputMeta}, but optional — `meta` is never required when authoring. */
type InputMeta<M> = [M] extends [never] ? { meta?: undefined } : { meta?: M };

/**
 * Fields shared by the stored {@link MenuItem} and the input {@link MenuItemInput}
 * — everything except `meta` (which differs in optionality between the two; see
 * {@link OutputMeta} / {@link InputMeta}).
 *
 * Note there is no `match`/`active`: the `<Menu>` renderer is router-agnostic and
 * knows nothing about the active path. Active-state matching lives entirely in the
 * consumer's `Item` component, which talks to its own router.
 */
export interface MenuItemBase<M = never> {
	title: string;
	icon?: ReactNode;
	/** Initial expanded state when the item has children. Default `true`. */
	defaultOpen?: boolean;
	/**
	 * Whether a section (an item with children) can be collapsed. Default `true`.
	 * Set `false` for an always-open group header: `<Menu>` keeps it expanded and
	 * hands its `Item` the non-collapsible prop variant (no `open`/`toggle`).
	 * Ignored for leaf links (nothing to collapse).
	 */
	collapsible?: boolean;
	/** Custom JSX rendered before the item. */
	before?: MenuSlot<M>;
	/** Custom JSX rendered after the item. */
	after?: MenuSlot<M>;
}

/**
 * A single, normalized navigation entry — the renderer's model. A node with
 * `items` is a (collapsible) section, one with `href` is a link, both → a
 * clickable section. Built by {@link defineMenu} from the keyed {@link MenuInput}.
 *
 * `meta` is **required** here when a meta type `M` is given — {@link defineMenu}
 * guarantees its presence (defaulting a missing one to `{}`), so the renderer's
 * `Item` reads it without optional chaining. `M` should therefore be a shape with
 * only optional fields (a badge, flags, counters); that's the metadata use-case.
 */
export type MenuItem<M = never> = MenuItemBase<M> &
	OutputMeta<M> & {
		/** Link target — internal route or external URL. Absent → pure container. */
		href?: string;
		/** Child entries → renders as a collapsible section. */
		items?: MenuItem<M>[];
	};

/** Stored, normalized navigation tree consumed by the renderer. */
export type Menu<M = never> = MenuItem<M>[];

/**
 * Authoring/adapter *input* value. The {@link MenuInput} is an **object keyed by
 * identity** (the item's `href`, or an arbitrary id for a pure container);
 * hierarchy is expressed by `parent` (another key), not by nesting. This makes
 * the keyed override (`{ ...generated, '/button': { … } }`) and adding a custom
 * child (point `parent` at a generated key) both trivial, and lets `parent` be
 * type-checked via `keyof` — no de-dup pass, no phantom brands.
 *
 * `Parent` is the union of sibling keys allowed for `parent`; {@link defineMenu}
 * infers it (`keyof` the input, including route paths from an adapter spread).
 */
export type MenuItemInput<Parent extends string = string, M = never> =
	MenuItemBase<M> &
		InputMeta<M> & {
			/**
			 * Link target. Defaults to the entry's key. Set `false` for a
			 * non-navigable container whose key is just an id.
			 */
			href?: string | false;
			/** Key of the parent entry. Absent → top level. */
			parent?: Parent;
			/** Sort hint among siblings (lower first). Stripped from the output. */
			order?: number;
		};

/** Input accepted by {@link defineMenu}: an object keyed by `href`/id. */
export type MenuInput<M = never> = Record<string, MenuItemInput<string, M>>;
