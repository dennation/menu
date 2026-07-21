import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { defineMenu } from "../../defineMenu";
import type { MenuItem, Menu as MenuModel } from "../../types";
import { Menu, type MenuItemProps, type MenuProps } from "../Menu";
import { createMenuStateStore } from "../menuStateStore";
import { useMenu } from "../useMenu";

afterEach(cleanup);

/**
 * A minimal `Item`: the title is a button that toggles when the item is
 * collapsible, with `open`/`level` exposed as data attributes to assert on.
 */
const Item: ComponentType<MenuItemProps> = (props) => (
	<div
		data-level={props.level}
		data-active={props.isActive}
		data-contains-active={props.containsActive}
	>
		<button
			type="button"
			data-open={props.collapsible ? props.open : undefined}
			onClick={props.collapsible ? props.toggle : undefined}
		>
			{props.item.title}
		</button>
		{props.children}
	</div>
);

const wrap = (items: ReactNode) => <nav>{items}</nav>;

/** Render `<Menu>` with the default `Item`/wrap, overriding any props. */
function renderMenu(props: Partial<Omit<MenuProps, "children">>) {
	return render(
		<Menu menu={section()} renderItem={Item} {...props}>
			{wrap}
		</Menu>,
	);
}

const section = (extra?: Partial<MenuItem>): MenuModel => [
	{
		id: "/components",
		title: "Components",
		href: "/components",
		items: [{ id: "/button", title: "Button", href: "/button" }],
		...extra,
	},
];

const header = () => screen.getByText("Components");

/** An `Item` that counts how many times each entry renders, keyed by id. */
function countingItem(
	renders: Record<string, number>,
): ComponentType<MenuItemProps> {
	return (props) => {
		renders[props.item.id] = (renders[props.item.id] ?? 0) + 1;
		return (
			<div>
				<button
					type="button"
					onClick={props.collapsible ? props.toggle : undefined}
				>
					{props.item.title}
				</button>
				{props.children}
			</div>
		);
	};
}

// Two sibling sections, each with a child — for isolation assertions.
const twoSections = defineMenu({
	"/a": { title: "A" },
	"/a/x": { title: "AX", parent: "/a" },
	"/b": { title: "B" },
	"/b/y": { title: "BY", parent: "/b" },
});

describe("<Menu>", () => {
	it("renders the tree and tags each level with its depth", () => {
		renderMenu({});
		expect(header().closest("div")?.dataset.level).toBe("0");
		expect(screen.getByText("Button").closest("div")?.dataset.level).toBe("1");
	});

	it("wraps the items with the render-prop children", () => {
		renderMenu({});
		// `wrap` puts everything inside <nav>.
		expect(header().closest("nav")).not.toBeNull();
	});

	it("collapses and re-expands a section on toggle", () => {
		renderMenu({});
		expect(header().dataset.open).toBe("true");
		fireEvent.click(header());
		expect(header().dataset.open).toBe("false");
		fireEvent.click(header());
		expect(header().dataset.open).toBe("true");
	});

	it("keeps disclosure state on the item when siblings reorder", () => {
		const a = {
			id: "/a",
			title: "A",
			href: "/a",
			items: [{ id: "/a1", title: "A1", href: "/a1" }],
		};
		const b = {
			id: "/b",
			title: "B",
			href: "/b",
			items: [{ id: "/b1", title: "B1", href: "/b1" }],
		};
		const { rerender } = renderMenu({ menu: [a, b] });

		// Collapse B, then swap the order: B must stay collapsed, A untouched.
		fireEvent.click(screen.getByText("B"));
		expect(screen.getByText("B").dataset.open).toBe("false");
		rerender(
			<Menu menu={[b, a]} renderItem={Item}>
				{wrap}
			</Menu>,
		);
		expect(screen.getByText("B").dataset.open).toBe("false");
		expect(screen.getByText("A").dataset.open).toBe("true");
	});

	it("honours `defaultOpen: false`", () => {
		renderMenu({ menu: section({ defaultOpen: false }) });
		expect(header().dataset.open).toBe("false");
	});

	it("gives a `collapsible: false` group the static variant (no open/toggle)", () => {
		renderMenu({ menu: section({ collapsible: false }) });
		expect(header().dataset.open).toBeUndefined();
		// The always-open group still renders its children.
		expect(screen.getByText("Button").closest("div")?.dataset.level).toBe("1");
	});

	it("renders the renderBeforeItem/renderAfterItem slots with the item's state", () => {
		renderMenu({
			renderBeforeItem: ({ item, level }) => (
				<span>{`before:${item.title}:${level}`}</span>
			),
			renderAfterItem: ({ open }) => <span>{`after:${open}`}</span>,
		});
		// The encoded text proves the slot ran with the item's title/level/open;
		// getByText throws if it didn't. Order: before precedes the item's button.
		const before = screen.getByText("before:Components:0");
		const after = screen.getByText("after:true");
		expect(before.compareDocumentPosition(header())).toBe(
			Node.DOCUMENT_POSITION_FOLLOWING,
		);
		expect(header().compareDocumentPosition(after)).toBe(
			Node.DOCUMENT_POSITION_FOLLOWING,
		);
	});

	it("seeds uncontrolled state from `defaultOpen`", () => {
		renderMenu({ defaultOpen: { "/components": false } });
		expect(header().dataset.open).toBe("false");
	});

	it("re-renders only the toggled section, not siblings or their children", () => {
		const renders: Record<string, number> = {};
		renderMenu({ menu: twoSections, renderItem: countingItem(renders) });
		const before = { ...renders };

		fireEvent.click(screen.getByText("A")); // toggle section A only

		expect(renders["/a"]).toBe(before["/a"] + 1); // toggled node re-rendered
		// The whole sibling subtree is untouched — the tree does not re-render.
		expect(renders["/b"]).toBe(before["/b"]);
		expect(renders["/b/y"]).toBe(before["/b/y"]);
	});

	it("does not re-render any node when the parent re-renders (memo isolation)", () => {
		const renders: Record<string, number> = {};
		const CountingItem = countingItem(renders);
		const { rerender } = render(
			<Menu menu={twoSections} renderItem={CountingItem}>
				{wrap}
			</Menu>,
		);
		const before = { ...renders };

		// A parent re-render with unchanged props: every node must be skipped,
		// otherwise any unrelated state change upstream would repaint the menu.
		rerender(
			<Menu menu={twoSections} renderItem={CountingItem}>
				{wrap}
			</Menu>,
		);

		expect(renders).toEqual(before);
	});

	it("notifies `onOpenChange` with the next state on toggle", () => {
		const changes: Array<Record<string, boolean>> = [];
		renderMenu({ onOpenChange: (next) => changes.push(next) });
		fireEvent.click(header()); // collapse
		expect(changes).toEqual([{ "/components": false }]);
	});

	it("renders from an external store and reflects its changes", () => {
		const store = createMenuStateStore({ "/components": false });
		renderMenu({ store });
		expect(header().dataset.open).toBe("false");

		act(() => store.set("/components", true));
		expect(header().dataset.open).toBe("true");
	});
});

describe("useMenu + <Menu> re-render isolation", () => {
	it("setActive expands only the active branch, not sibling subtrees", () => {
		const renders: Record<string, number> = {};
		const CountingItem = countingItem(renders);
		function Harness() {
			const { menuProps, setActive } = useMenu(twoSections, {
				defaultOpen: { "/a": false, "/b": false },
			});
			return (
				<>
					<button type="button" onClick={() => setActive("/a/x")}>
						go
					</button>
					<Menu {...menuProps} renderItem={CountingItem}>
						{wrap}
					</Menu>
				</>
			);
		}
		render(<Harness />);
		const before = { ...renders };

		fireEvent.click(screen.getByText("go")); // navigate: active = /a/x

		// Branch /a expands (its node re-renders); sibling subtree /b is untouched
		// even though the Harness (and <Menu>) re-rendered from setActive.
		expect(renders["/a"]).toBe(before["/a"] + 1);
		expect(renders["/b"]).toBe(before["/b"]);
		expect(renders["/b/y"]).toBe(before["/b/y"]);
	});

	it("passes `active` to the item when setActive marks it", () => {
		function Harness() {
			const { menuProps, setActive } = useMenu(twoSections);
			return (
				<>
					<button type="button" onClick={() => setActive("/a")}>
						go
					</button>
					<Menu {...menuProps} renderItem={Item}>
						{wrap}
					</Menu>
				</>
			);
		}
		render(<Harness />);
		const a = () => screen.getByText("A").closest("div");

		expect(a()?.dataset.active).toBe("false");
		fireEvent.click(screen.getByText("go"));
		expect(a()?.dataset.active).toBe("true");
	});

	it("marks ancestors of the active item with containsActive", () => {
		function Harness() {
			const { menuProps, setActive } = useMenu(twoSections);
			return (
				<>
					<button type="button" onClick={() => setActive("/a/x")}>
						go
					</button>
					<Menu {...menuProps} renderItem={Item}>
						{wrap}
					</Menu>
				</>
			);
		}
		render(<Harness />);
		const box = (title: string) => screen.getByText(title).closest("div");

		fireEvent.click(screen.getByText("go")); // active = /a/x (a leaf under /a)

		// /a is an ancestor of the active leaf → containsActive, not active.
		expect(box("A")?.dataset.containsActive).toBe("true");
		expect(box("A")?.dataset.active).toBe("false");
		// The active leaf itself: active, but does not contain the active below it.
		expect(box("AX")?.dataset.active).toBe("true");
		expect(box("AX")?.dataset.containsActive).toBe("false");
		// Unrelated sibling branch: neither.
		expect(box("B")?.dataset.containsActive).toBe("false");
	});

	it("does not re-render a common ancestor when active moves within its branch", () => {
		const renders: Record<string, number> = {};
		const CountingItem = countingItem(renders);
		const menu = defineMenu({
			"/a": { title: "A" },
			"/a/x": { title: "AX", parent: "/a" },
			"/a/y": { title: "AY", parent: "/a" },
			"/b": { title: "B" },
		});
		function Harness() {
			const { menuProps, setActive } = useMenu(menu, {
				defaultActiveId: "/a/x",
			});
			return (
				<>
					<button type="button" onClick={() => setActive("/a/y")}>
						go
					</button>
					<Menu {...menuProps} renderItem={CountingItem}>
						{wrap}
					</Menu>
				</>
			);
		}
		render(<Harness />);
		const before = { ...renders };

		fireEvent.click(screen.getByText("go")); // active /a/x -> /a/y, both under /a

		expect(renders["/a/x"]).toBe(before["/a/x"] + 1); // was active
		expect(renders["/a/y"]).toBe(before["/a/y"] + 1); // now active
		// /a's containsActive stayed true, so it must not re-render.
		expect(renders["/a"]).toBe(before["/a"]);
		expect(renders["/b"]).toBe(before["/b"]);
	});

	it("re-renders only the old and new active nodes when the active changes", () => {
		const renders: Record<string, number> = {};
		const CountingItem = countingItem(renders);
		const flat = defineMenu({
			"/a": { title: "A" },
			"/b": { title: "B" },
			"/c": { title: "C" },
		});
		function Harness() {
			const { menuProps, setActive } = useMenu(flat, { defaultActiveId: "/a" });
			return (
				<>
					<button type="button" onClick={() => setActive("/b")}>
						go
					</button>
					<Menu {...menuProps} renderItem={CountingItem}>
						{wrap}
					</Menu>
				</>
			);
		}
		render(<Harness />);
		const before = { ...renders };

		fireEvent.click(screen.getByText("go")); // active /a -> /b

		expect(renders["/a"]).toBe(before["/a"] + 1); // was active
		expect(renders["/b"]).toBe(before["/b"] + 1); // now active
		expect(renders["/c"]).toBe(before["/c"]); // untouched
	});
});
