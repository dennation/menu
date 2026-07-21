# @dennation/menu

Headless, typesafe, router-agnostic navigation menu — you own every element and style; it owns the tree, the disclosure state, and the active branch. A data model (`defineMenu`), a React renderer (`<Menu>`), and a `useMenu` hook.

`<Menu>` renders none of its own markup: it drives recursion and state, you supply the `renderItem` component and the shell. It gives you a11y primitives (a stable `id` for `aria-controls`/`aria-expanded`), but keyboard/focus handling is yours.

```bash
pnpm add @dennation/menu
```

## Usage

```tsx
import { defineMenu } from "@dennation/menu";

const menu = defineMenu({
	"/": { title: "Dashboard" },
	"/projects": { title: "Projects" },
	"/projects/active": { title: "Active", parent: "/projects" },
	"/projects/archived": { title: "Archived", parent: "/projects" },
	"/settings": { title: "Settings" },
	"/settings/profile": { title: "Profile", parent: "/settings" },
	"/settings/billing": { title: "Billing", parent: "/settings" },
	"https://docs.example.com": { title: "Docs" }, // external URL as its own href
});
```

Render it with your own `Item` and wrap the items in your own shell via the
render-prop `children` — `<Menu>` owns the open/closed state, the active item,
and recursion; the `Item` renders the link. `Item` props are
discriminated on `collapsible`, so `open`/`toggle` exist only on a section;
`isActive` is on every item:

```tsx
import { Menu, type MenuItemProps, type MenuProps } from "@dennation/menu/react";

function Item(props: MenuItemProps) {
	const { item, level, isActive } = props;
	const indent = level > 0 ? "pl-4" : "";

	const link = item.href ? (
		<a
			href={item.href}
			aria-current={isActive ? "page" : undefined}
			className="block rounded px-3 py-2 hover:bg-gray-100 aria-[current]:font-semibold aria-[current]:text-blue-600"
		>
			{item.title}
		</a>
	) : (
		<span className="px-3 py-2 text-xs font-medium uppercase text-gray-500">
			{item.title}
		</span>
	);

	// A collapsible section: the link plus a toggle, then its children.
	if (props.collapsible) {
		return (
			<li className={indent}>
				<div className="flex items-center">
					{link}
					<button
						type="button"
						onClick={props.toggle}
						aria-expanded={props.open}
						className="px-2 text-gray-400"
					>
						{props.open ? "−" : "+"}
					</button>
				</div>
				{props.children}
			</li>
		);
	}

	// A leaf link or an always-open group header — no toggle.
	return (
		<li className={indent}>
			{link}
			{props.children}
		</li>
	);
}
```

Bind your `Item` and shell once in an `AppMenu`, then pass only data props at
each call site:

```tsx
function AppMenu(props: Omit<MenuProps, "renderItem" | "children">) {
	return (
		<Menu {...props} renderItem={Item}>
			{(items) => <nav aria-label="Main"><ul>{items}</ul></nav>}
		</Menu>
	);
}
```

The shell is fully yours — put a search box, a header, or a footer around
`{items}` however you need. `<Menu>` renders only the entries.

Finally, make it aware of the current page with `useMenu`: it highlights the
active item, expands its branch, and gives you the breadcrumb `trail`. You tell
it which item is active (resolve the id however your router works); it holds the
open/closed state and hands `<Menu>` a store via `menuProps`:

```tsx
import { findMenuItemBy } from "@dennation/menu";
import { useMenu } from "@dennation/menu/react";

function Sidebar() {
	const { pathname } = useLocation();
	const { menuProps, trail, setActive } = useMenu(menu);

	// Resolve the active item however you like (exact, prefix, router match) and
	// pass its id — it need not equal the path.
	useEffect(() => {
		const active = findMenuItemBy(menu, (i) => i.href === pathname);
		setActive(active?.id);
	}, [pathname]);

	return (
		<>
			<Breadcrumbs trail={trail} />
			<AppMenu {...menuProps} />
		</>
	);
}
```

That's a complete router-aware sidebar. `useMenu` is optional — `<AppMenu menu={menu} />`
on its own still renders and toggles sections, it just won't track the active
route. Because the state lives in a store, toggling one section re-renders only
that node, never the whole `Sidebar`.

## API

### Core (`@dennation/menu`)

- **`defineMenu(input)`** — resolves a keyed `MenuInput` into a nested `Menu`. The input is an object keyed by identity (the entry's `href` by default, or an arbitrary id when `href: false`); hierarchy comes from `parent`, not nesting. Siblings sort by `order`, then insertion order. Items with an unknown `parent` are hoisted to the top level with a dev warning; a `parent` cycle warns too. Each output `MenuItem` carries its input key as a stable `id` — use it for React keys, `aria-controls`, or matching a node back to your data.
- **`getMenuTrail(menu, id)` / `findMenuItem(menu, id)`** — the ancestor chain / the item for an exact `id`. **`…By(menu, predicate)`** variants match by any condition (first pre-order match) — resolve an active item by prefix/router-match/role off React and feed its `id` to `useMenu`.

### `<Menu>` (`@dennation/menu/react`)

The renderer. Props:

| Prop | Type | |
| --- | --- | --- |
| `menu` | `Menu<M>` | The tree from `defineMenu`. |
| `renderItem` | `ComponentType<MenuItemProps<M>>` | Component each entry renders through. |
| `children` | `(items: ReactNode) => ReactNode` | Wraps the items in your shell. |
| `renderBeforeItem?` / `renderAfterItem?` | `ComponentType<MenuSlotProps<M>>` | Component rendered around each item (divider, group heading). |
| `store?` | `MenuStateStore` | State store from `useMenu`. Omit → `<Menu>` owns state. |
| `defaultOpen?` | `MenuOpenState` | Initial disclosure when `<Menu>` owns it. |
| `onOpenChange?` | `(next: MenuOpenState) => void` | Notified on every toggle (persistence). |

### `useMenu(menu, options?)` (`@dennation/menu/react`)

Owns the active item and disclosure state.

**Options**

| Option | Type | |
| --- | --- | --- |
| `defaultActiveId?` | `string` | Initial active item; its branch is expanded. |
| `defaultOpen?` | `MenuOpenState` | Initial disclosure state. |

**Returns**

| Field | Type | |
| --- | --- | --- |
| `menuProps` | `{ menu, store }` | Spread into `<Menu>`. |
| `activeId` | `string \| undefined` | Current active id (readonly). |
| `activeItem` | `MenuItem<M> \| undefined` | Current active item (readonly). |
| `setActive` | `(id: string \| undefined) => void` | Set active by id; expands its branch. |
| `trail` | `MenuItem<M>[]` | Root → active item (breadcrumbs). |
| `isOpen` | `(id: string) => boolean` | Whether a section is open. |
| `open` / `close` / `toggle` | `(id: string) => void` | Drive one section. |
| `subscribeOpenState` | `(listener) => () => void` | Subscribe to changes (no re-render). |

### Types

**Menu item** — an entry: `MenuItemInput` on the way into `defineMenu`, `MenuItem` on the way out.

| Field | Type | Where | |
| --- | --- | --- | --- |
| `title` | `string` | both | Display text. |
| `href` | `string \| false` (in) / `string` (out) | both | Link target; `false` on input → non-navigable container. Defaults to the entry key. |
| `id` | `string` | out | Stable identity — the input key. |
| `parent` | `string` | in | Parent entry's key → nesting. |
| `order` | `number` | in | Sort hint among siblings (lower first). |
| `items` | `MenuItem<M>[]` | out | Resolved children. |
| `defaultOpen` | `boolean` | both | Start a section expanded (default `true`). |
| `collapsible` | `boolean` | both | `false` → always-open group header. |
| `meta` | `M` | both | Opaque per-item data (see below). |

**`MenuItemProps<M>`** — what your `renderItem` receives, discriminated on `collapsible`:

| Field | Type | |
| --- | --- | --- |
| `item` | `MenuItem<M>` | The entry to render. |
| `level` | `number` | Nesting depth (`0` at the top). |
| `isActive` | `boolean` | Whether this is the active item (from `useMenu`'s `setActive`). |
| `containsActive` | `boolean` | Whether the active item is anywhere in this item's subtree — highlight a section whose child is active. |
| `collapsible` | `boolean` | Discriminant. |
| `open` / `toggle` | `boolean` / `() => void` | Present only when `collapsible: true`. |
| `children` | `ReactNode` | The rendered nested level (required on a section, optional on a leaf). |

**`MenuItemPropsOf<typeof menu>`** — the same props with `M` inferred from a `menu`, so a standalone `Item` doesn't repeat the meta type. See [Menu with icons](#menu-with-icons).

**`MenuSlotProps<M>`** — what a `renderBeforeItem`/`renderAfterItem` slot receives: the `item` plus its state, without `toggle`/`children` (a slot renders *next to* the item, it doesn't control or contain it):

| Field | Type | |
| --- | --- | --- |
| `item` | `MenuItem<M>` | The item this slot is rendered next to. |
| `level` | `number` | Nesting depth (`0` at the top). |
| `open` | `boolean` | Whether the item's section is expanded. |
| `isActive` | `boolean` | Whether the item is the active item. |
| `containsActive` | `boolean` | Whether the active item is in the item's subtree. |

### Per-item `meta`

Attach your own data to items (badges, flags, counters) via `meta`. `defineMenu`
**infers** its type `M` from the input's `meta` fields — the library carries it
verbatim and never reads it, and it's that type everywhere (input, output, `Item`):

```tsx
const menu = defineMenu({ "/inbox": { title: "Inbox", meta: { count: 3 } } });
menu[0].meta.count; // number
```

## Adapters

An adapter turns a framework's route/config shape into a `MenuInput` you spread into `defineMenu`. It's only a *source* — `defineMenu` stays the single place that assembles the tree, so you can mix adapters with manual entries in one spread.

### TanStack Router

```tsx
import { defineMenu } from "@dennation/menu";
import { menuInputFromRouteTree } from "@dennation/menu/adapters/tanstack-router";
import { routeTree } from "./routeTree.gen";

const menu = defineMenu(menuInputFromRouteTree(routeTree, { omit: ["/login"] }));
```

Because it returns plain `MenuInput`, you can mix it with manual entries in the
same `defineMenu` spread — see [Custom entries in a generated menu](#custom-entries-in-a-generated-menu).

**`menuInputFromRouteTree(routeTree, options?)`** walks the route tree into a `MenuInput` keyed by `fullPath`. Pathless and layout routes are transparent; `omit` drops a route with its subtree (typed against the tree). How a route describes itself is read from `staticData.menu` — override the source with `getRouteMenu`:

```tsx
createFileRoute("/button")({
	component: ButtonPage,
	staticData: { menu: { title: "Button", order: 2, meta: { badge: "new" } } },
});
```

`title` falls back to a title-cased last path segment; `order`/`meta` come from `staticData.menu`.

Register `menu` on `staticData` once, so it's typed at every route (including
`meta` under your own type):

```tsx
import type { RouteMenuEntry } from "@dennation/menu/adapters/tanstack-router";

declare module "@tanstack/router-core" {
	interface StaticDataRouteOption {
		menu?: RouteMenuEntry<Meta>;
	}
}
```

That register is the **only** place you name `Meta`: it flows through
`menuInputFromRouteTree` into `defineMenu`, so `defineMenu(menuInputFromRouteTree(routeTree))`
is typed `Menu<Meta>` with no explicit type argument.

## Guides

Recipes for the cases that don't fit the happy path.

### External links

An entry's `href` can be any URL — it's just the key. Branch in your `Item` on
the shape you care about:

```tsx
{item.href?.startsWith("http") ? (
	<a href={item.href} target="_blank" rel="noreferrer">{item.title}</a>
) : (
	<Link to={item.href}>{item.title}</Link>
)}
```

### Group headers (non-navigable)

Give a container `href: false` and it becomes an id-only entry with no link;
children point their `parent` at that id. Add `collapsible: false` for a header
that stays open:

```tsx
defineMenu({
	team: { title: "Team", href: false, collapsible: false },
	"/members": { title: "Members", parent: "team" },
	"/roles": { title: "Roles", parent: "team" },
});
```

### Persisting open sections

`subscribeOpenState` fires on every change without re-rendering; seed the next
mount from `defaultOpen`:

```tsx
const saved = JSON.parse(localStorage.getItem("menu-open") ?? "{}");
const { menuProps, subscribeOpenState } = useMenu(menu, { defaultOpen: saved });

useEffect(
	() =>
		subscribeOpenState((open) =>
			localStorage.setItem("menu-open", JSON.stringify(open)),
		),
	[subscribeOpenState],
);
```

### A search box (or anything) in the shell

The render-prop `children` gives you full control of the wrapper — put a search
box, header, or footer around `{items}`. Its state is yours; keep the shell a
stable component so that state survives re-renders:

```tsx
<Menu menu={menu} renderItem={Item}>
	{(items) => (
		<nav>
			<SearchBox />
			<ul>{items}</ul>
		</nav>
	)}
</Menu>
```

If the search filters the menu, filter the `menu` data outside `<Menu>` and pass
the result — disclosure state is keyed by `id`, so filtering never loses open
sections.

### Custom entries in a generated menu

`menuInputFromRouteTree` returns plain `MenuInput`, so spread it and add,
override, or re-parent entries in the same object — `parent` is type-checked
against the route paths:

```tsx
const menu = defineMenu({
	...menuInputFromRouteTree(routeTree),
	"/changelog": { title: "Changelog", parent: "/settings" }, // entry with no route
	"/settings": { title: "Settings", order: 0 },              // override generated
	"https://docs.example.com": { title: "Docs" },             // external link
});
```

### Menu with icons

The model has no `icon` field — it stays free of React. Put the icon in `meta`
(which the library carries but never reads) and render it in your `Item`:

```tsx
import type { MenuItemPropsOf } from "@dennation/menu/react";

const menu = defineMenu({
	"/": { title: "Dashboard", meta: { icon: <Home /> } },
	"/settings": { title: "Settings", meta: { icon: <Cog /> } },
});

// `MenuItemPropsOf<typeof menu>` infers the meta type from `menu` — no repeat.
function Item(props: MenuItemPropsOf<typeof menu>) {
	return (
		<a href={props.item.href} className="flex items-center gap-2">
			{props.item.meta?.icon}
			{props.item.title}
		</a>
	);
}
```

With the TanStack adapter, icons ride along in `staticData.menu.meta`.

## License

MIT
