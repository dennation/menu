import type { Menu, MenuInput, MenuItem, MenuItemInput } from "./types";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Sort key for an entry with no explicit `order`: sorts after every ordered
 * sibling, while the insertion index (a secondary tiebreaker) preserves the
 * authored sequence among them.
 */
const ORDER_UNSPECIFIED = Number.MAX_SAFE_INTEGER;

/**
 * The `parent` constraint: the keys of the input object. For a dynamically-typed
 * `MenuInput` (`Record<string, …>`) this widens to `string`, so building a menu
 * from runtime data still type-checks; literal objects keep the precise key union.
 */
type MenuKeys<T> = Extract<keyof T, string>;

/**
 * Meta-opaque views for the internal pipeline: the runtime never inspects `meta`,
 * so the resolver works against an `unknown`-meta shape and the public result is
 * cast back to `Menu<M>`. (`MenuSlot`'s `meta` makes the item types contravariant
 * in `M`, so threading `M` through every helper would fight variance for no gain.)
 */
type LooseInput = MenuItemInput<string, unknown>;
type LooseNode = MenuItem<unknown>;

/** An output node paired with everything needed to place it in the tree. */
interface PlacedNode {
	key: string;
	node: LooseNode;
	/** Key of the parent entry, or `undefined` for a top-level entry. */
	parentKey: string | undefined;
	/** Resolved sort order; {@link ORDER_UNSPECIFIED} when none was given. */
	order: number;
	/** Position in the authored input — a stable tiebreaker for equal `order`. */
	index: number;
}

/**
 * Resolve a keyed {@link MenuInput} into a nested {@link Menu}:
 *
 * - the object key is the entry's identity — its `href` by default, or an id for
 *   a container with `href: false`; duplicate keys are impossible, so an override
 *   is plain object spread (`{ ...generated, '/button': { … } }`), no de-dup pass;
 * - **`parent`** (another key) is resolved into nesting; an unknown `parent`
 *   hoists the entry to the top level (with a dev warning);
 * - **siblings are sorted by `order`** (ascending; unordered keep their authored
 *   order, last);
 * - the input-only `parent` / `order` fields are **stripped**, and `href` (the
 *   key by default) is resolved onto each node.
 *
 * `parent` is type-checked against `keyof` the input — including route paths that
 * flow in from a router adapter spread.
 *
 * `M` types the opaque per-item `meta`. It's the **first** type parameter so it
 * can be given explicitly (`defineMenu<MyMeta>(…)`) while `T` is still inferred
 * from the argument; left off, it defaults to `never` — the menu has no usable
 * `meta`. With a type, `meta` is optional when authoring but **guaranteed on the
 * output node** (a missing one defaults to `{}`), so the renderer's `Item` reads
 * `item.meta.x` without optional chaining. Either way `parent` stays checked
 * against the inferred keys.
 */
export function defineMenu<
	M = never,
	const T extends Record<
		string,
		MenuItemInput<MenuKeys<T>, M> | undefined
	> = Record<string, MenuItemInput<string, M>>,
>(input: T): Menu<M> {
	const placed = definedEntries(input as unknown as MenuInput<unknown>).map(
		toPlacedNode,
	);
	const nodeByKey = new Map(placed.map((entry) => [entry.key, entry.node]));

	// Split entries into roots and per-parent buckets. An entry whose `parent`
	// names no known key is hoisted to the top level (with a warning).
	const roots: PlacedNode[] = [];
	const childrenByParent = new Map<string, PlacedNode[]>();

	for (const entry of placed) {
		const { parentKey } = entry;
		if (parentKey == null) {
			roots.push(entry);
		} else if (nodeByKey.has(parentKey)) {
			appendChild(childrenByParent, parentKey, entry);
		} else {
			warnUnknownParent(entry);
			roots.push(entry);
		}
	}

	// Attach each bucket as the parent node's sorted children.
	for (const [parentKey, children] of childrenByParent) {
		const parentNode = nodeByKey.get(parentKey);
		if (parentNode) parentNode.items = toSortedNodes(children);
	}

	return toSortedNodes(roots) as unknown as Menu<M>;
}

/**
 * Input entries whose value is present. `undefined` values arrive from a
 * `Partial` adapter result (e.g. an `omit`ted route in `menuFromRouteTree`);
 * dropping them keeps the keyed input composable via spread.
 */
function definedEntries(
	input: Record<string, LooseInput | undefined>,
): [string, LooseInput][] {
	return Object.entries(input).filter(
		(entry): entry is [string, LooseInput] => entry[1] != null,
	);
}

/** Build the output node for one input entry and capture its placement metadata. */
function toPlacedNode(
	[key, value]: [string, LooseInput],
	index: number,
): PlacedNode {
	const { href, parent, order, meta, ...fields } = value;
	const resolvedHref = resolveHref(key, href);
	const node: LooseNode = {
		...fields,
		// Output `meta` is required when a meta type is set; guarantee its presence
		// so the consumer's `Item` reads `item.meta.x` without optional chaining.
		meta: meta ?? {},
		...(resolvedHref != null && { href: resolvedHref }),
	};
	return {
		key,
		node,
		parentKey: parent,
		order: order ?? ORDER_UNSPECIFIED,
		index,
	};
}

/** The entry's link target: its key by default, or none when `href: false`. */
function resolveHref(
	key: string,
	href: string | false | undefined,
): string | undefined {
	if (href === false) return undefined;
	return href ?? key;
}

function appendChild(
	buckets: Map<string, PlacedNode[]>,
	parentKey: string,
	entry: PlacedNode,
): void {
	const siblings = buckets.get(parentKey);
	if (siblings) siblings.push(entry);
	else buckets.set(parentKey, [entry]);
}

/** Sort siblings by `order`, then by authored position, returning their nodes. */
function toSortedNodes(entries: PlacedNode[]): LooseNode[] {
	return [...entries]
		.sort((a, b) => a.order - b.order || a.index - b.index)
		.map((entry) => entry.node);
}

function warnUnknownParent({ node, parentKey }: PlacedNode): void {
	if (!isDev) return;
	console.warn(
		`[menu] item "${node.title}" has unknown parent "${parentKey}"; hoisting to top level`,
	);
}
