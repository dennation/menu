# @dennation/menu

Router-agnostic navigation menu: a data model (`defineMenu`), a React renderer (`<Menu>`), and a TanStack Router adapter (`menuFromRouteTree`).

```bash
pnpm add @dennation/menu
```

## Usage

```tsx
import { defineMenu } from "@dennation/menu";
import { menuFromRouteTree } from "@dennation/menu/tanstack-router";
import { routeTree } from "./route-tree.gen";

const menu = defineMenu({
	...menuFromRouteTree(routeTree, { omit: ["/about"] }),
	// add a custom child into a generated section — `parent` is type-checked against the routes
	"/changelog": { title: "Changelog", parent: "/components" },
	"/button": { title: "Button", icon: <Cube /> }, // overrides the generated entry
	"https://github.com/dennation/menu": { title: "GitHub" },
});
```

Render it with your own `Container` and `Item` — `<Menu>` owns the open/closed state and recursion, the `Item` owns the link, icon, and active state:

```tsx
import { Menu } from "@dennation/menu/react";

<Menu menu={menu} components={{ Container, Item }} />;
```

## API

- **`defineMenu(input)`** — resolves a keyed `MenuInput` into a nested `Menu`. The input is an object keyed by identity (the entry's `href` by default, or an arbitrary id when `href: false`); hierarchy comes from `parent`, not nesting. Siblings sort by `order`, then insertion order. Items with an unknown `parent` are hoisted to the top level with a dev warning.
- **`<Menu menu components before after />`** (`/react`) — the renderer. Custom JSX goes in the `before`/`after` slots: `(item, { open, level }) => ReactNode`.
- **`menuFromRouteTree(routeTree, options?)`** (`/tanstack-router`) — walks a TanStack route tree into a `MenuInput` keyed by `fullPath`. Pathless and layout routes are transparent; `omit` drops a route with its subtree. Per-route metadata is read from `staticData.menu.meta`:

  ```tsx
  createFileRoute("/button")({
  	component: ButtonPage,
  	staticData: { menu: { meta: { title: "Button", order: 2 } } },
  });
  ```

### Per-item `meta`

Items carry consumer metadata (badges, flags, counters) via a generic `M` that threads through the whole chain. It defaults to `never`; give it a shape with `defineMenu<MyMeta>(…)` and `meta` is that type everywhere, input and output. Make it optional with `defineMenu<MyMeta | undefined>(…)`. `meta` passes through verbatim — neither `defineMenu` nor the renderer reads it.

## Development

```bash
pnpm install
pnpm run build      # vite build — 3 entry points
pnpm run typecheck
pnpm run test
```

## License

MIT
