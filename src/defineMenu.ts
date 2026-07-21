import type { Menu, MenuItem, MenuItemInput } from "./types";

const isDev =
	typeof process !== "undefined" && process.env?.NODE_ENV !== "production";

/** Sort key for an entry with no explicit `order`: after every ordered sibling. */
const UNORDERED = Number.MAX_SAFE_INTEGER;

/**
 * The `parent` constraint: the keys of the input object. For a dynamically-typed
 * input (`Record<string, …>`) this widens to `string`, so building a menu from
 * runtime data still type-checks; literal objects keep the precise key union.
 */
type MenuKeys<T> = Extract<keyof T, string>;

/**
 * The input `defineMenu` accepts, expressed against itself so `parent` is checked
 * against the object's own keys ({@link MenuKeys}). `meta` is left `unknown` here
 * and its real type is inferred separately by {@link MetaOf}.
 */
type DefineMenuInput<T> = Record<
	string,
	MenuItemInput<MenuKeys<T>, unknown> | undefined
>;

/**
 * The per-item `meta` type inferred from a menu input — the `meta` field of its
 * values (`NonNullable` drops the `Partial`/`undefined` from adapter results).
 */
type MetaOf<T> = NonNullable<T[keyof T]> extends { meta?: infer M } ? M : never;

/**
 * Meta-opaque views for the internal pipeline: the runtime never inspects `meta`
 * (it just rides through), so the resolver works at `unknown` meta and the
 * result is cast back to `Menu<M>`.
 */
type LooseInput = MenuItemInput<string, unknown>;
type LooseNode = MenuItem<unknown>;

/**
 * Resolve a keyed menu input into a nested {@link Menu}: `parent` becomes
 * nesting, siblings sort by `order` (unordered last, authored order kept among
 * equals), the input-only `parent`/`order` are stripped, and `href` falls back
 * to the entry key. An unknown `parent` hoists the entry to the top level.
 *
 * The per-item `meta` type is **inferred** from the input's `meta` fields (see
 * {@link MetaOf}), so `defineMenu(menuInputFromRouteTree(tree))` yields the menu
 * typed with your registered meta — no explicit type argument. `meta` passes
 * through verbatim and is never read here.
 */
export function defineMenu<const T extends DefineMenuInput<T>>(
	input: T,
): Menu<MetaOf<T>> {
	// One stable sort over the flat list. `Array#sort` is stable, so every
	// parent's bucket comes out ordered without a second per-level pass.
	const entries = Object.entries(
		input as Record<string, LooseInput | undefined>,
	)
		.filter((entry): entry is [string, LooseInput] => entry[1] != null)
		.sort(([, a], [, b]) => (a.order ?? UNORDERED) - (b.order ?? UNORDERED));

	// Build every node up front; `nodeByKey` is only for resolving `parent`.
	const placed = entries.map(([key, item]) => ({
		key,
		item,
		node: toNode(key, item),
	}));
	const nodeByKey = new Map(placed.map(({ key, node }) => [key, node]));
	const roots: LooseNode[] = [];

	for (const { item, node } of placed) {
		const parent = item.parent == null ? undefined : nodeByKey.get(item.parent);
		if (parent) {
			parent.items ??= [];
			parent.items.push(node);
		} else {
			if (isDev && item.parent != null) warnUnknownParent(item);
			roots.push(node);
		}
	}

	// A `parent` cycle links its nodes to each other but off the tree.
	if (isDev && countNodes(roots) !== entries.length)
		console.warn(
			"[menu] cyclic `parent` detected; the cycle's items were dropped",
		);

	return roots as unknown as Menu<MetaOf<T>>;
}

/** Build the output node: strip the input-only fields and resolve `href`. */
function toNode(
	key: string,
	{ href, parent, order, ...fields }: LooseInput,
): LooseNode {
	// `meta`, when present, rides through in `...fields` untouched.
	const resolvedHref = href === false ? undefined : (href ?? key);
	return {
		id: key,
		...fields,
		...(resolvedHref != null && { href: resolvedHref }),
	};
}

function warnUnknownParent({ title, parent }: LooseInput): void {
	console.warn(
		`[menu] item "${title}" has unknown parent "${parent}"; hoisting to top level`,
	);
}

function countNodes(nodes: LooseNode[]): number {
	return nodes.reduce(
		(count, node) => count + 1 + countNodes(node.items ?? []),
		0,
	);
}
