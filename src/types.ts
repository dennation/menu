/**
 * The opaque per-item metadata field, used **identically** on input and output.
 * `[M]` wrappers stop the conditional distributing over a union.
 *
 * - `M = never` (the default): no usable `meta`.
 * - `undefined` assignable to `M` (`Foo | undefined`): `meta` is optional.
 * - otherwise: `meta` is required and typed `M`, so the consumer's `Item` reads
 *   `item.meta.x` with no optional chaining.
 */
type MetaField<M> = [M] extends [never]
	? { meta?: undefined }
	: undefined extends M
		? { meta?: M }
		: { meta: M };

/** Fields shared by the stored {@link MenuItem} and input {@link MenuItemInput}. */
export interface MenuItemBase<M = never> {
	title: string;
	/** Initial expanded state when the item has children. Default `true`. */
	defaultOpen?: boolean;
	/**
	 * Whether a section (an item with children) can be collapsed. Default `true`.
	 * `false` makes an always-open group header: it stays expanded and its `Item`
	 * gets the non-collapsible prop variant. Ignored for leaf links.
	 */
	collapsible?: boolean;
}

/**
 * A normalized navigation entry. With `items` it's a section, with `href` a
 * link, with both a clickable section.
 */
export type MenuItem<M = never> = MenuItemBase<M> &
	MetaField<M> & {
		/** Stable identity — the input key (unique across the tree). */
		id: string;
		/** Link target — internal route or external URL. Absent → pure container. */
		href?: string;
		/** Child entries → renders as a section. */
		items?: MenuItem<M>[];
	};

/** Normalized navigation tree consumed by the renderer. */
export type Menu<M = never> = MenuItem<M>[];

/**
 * Authoring/adapter input entry, keyed by identity. Hierarchy comes from
 * `parent` (a key), not nesting. `Parent` — the union of allowed parent keys,
 * inferred by {@link defineMenu} from the input.
 */
export type MenuItemInput<
	Parent extends string = string,
	M = never,
> = MenuItemBase<M> &
	MetaField<M> & {
		/**
		 * Link target. Defaults to the entry's key. `false` for a non-navigable
		 * container whose key is just an id.
		 */
		href?: string | false;
		/** Key of the parent entry. Absent → top level. */
		parent?: Parent;
		/** Sort hint among siblings (lower first). Stripped from the output. */
		order?: number;
	};

/** Input accepted by {@link defineMenu}: an object keyed by `href`/id. */
export type MenuInput<M = never> = Record<string, MenuItemInput<string, M>>;
