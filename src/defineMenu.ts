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
 * `M` types the opaque per-item `meta`. It comes first so it can be given
 * explicitly (`defineMenu<MyMeta>(…)`) while `T` is still inferred from the
 * argument; it passes through verbatim and is never read here.
 */
export function defineMenu<
	M = never,
	const T extends Record<
		string,
		MenuItemInput<MenuKeys<T>, M> | undefined
	> = Record<string, MenuItemInput<string, M>>,
>(input: T): Menu<M> {
	// One stable sort over the flat list. `Array#sort` is stable, so every
	// parent's bucket comes out ordered without a second per-level pass.
	const entries = Object.entries(
		input as Record<string, LooseInput | undefined>,
	)
		.filter((entry): entry is [string, LooseInput] => entry[1] != null)
		.sort(([, a], [, b]) => (a.order ?? UNORDERED) - (b.order ?? UNORDERED));

	const nodeByKey = new Map(
		entries.map(([key, item]) => [key, toNode(key, item)]),
	);
	const roots: LooseNode[] = [];

	for (const [key, item] of entries) {
		const node = nodeByKey.get(key) as LooseNode;
		const parent = item.parent == null ? undefined : nodeByKey.get(item.parent);
		if (parent) {
			parent.items ??= [];
			parent.items.push(node);
		} else {
			if (item.parent != null) warnUnknownParent(item);
			roots.push(node);
		}
	}

	if (isDev) warnUnreachable(roots, entries.length);
	return roots as unknown as Menu<M>;
}

/** Build the output node: strip the input-only fields and resolve `href`. */
function toNode(
	key: string,
	{ href, parent, order, ...fields }: LooseInput,
): LooseNode {
	// `meta`, when present, rides through in `...fields` untouched.
	const target = href === false ? undefined : (href ?? key);
	return { ...fields, ...(target != null && { href: target }) };
}

function warnUnknownParent({ title, parent }: LooseInput): void {
	if (!isDev) return;
	console.warn(
		`[menu] item "${title}" has unknown parent "${parent}"; hoisting to top level`,
	);
}

/** A cyclic `parent` chain links nodes to each other but off the tree. */
function warnUnreachable(roots: LooseNode[], total: number): void {
	if (countNodes(roots) === total) return;
	console.warn(
		"[menu] cyclic `parent` detected; the items in the cycle were dropped",
	);
}

function countNodes(nodes: LooseNode[]): number {
	return nodes.reduce(
		(count, node) => count + 1 + countNodes(node.items ?? []),
		0,
	);
}
