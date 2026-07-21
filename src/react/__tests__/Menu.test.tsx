import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { MenuItem, Menu as MenuModel } from "../../types";
import { Menu, type MenuComponents } from "../Menu";

afterEach(cleanup);

/**
 * A minimal consumer: the title is a button that toggles when the item is
 * collapsible, with `open`/`level` exposed as data attributes to assert on.
 */
const components: MenuComponents = {
	Container: ({ children }) => <nav>{children}</nav>,
	Item: (props) => (
		<div data-level={props.level}>
			<button
				type="button"
				data-open={props.collapsible ? props.open : undefined}
				onClick={props.collapsible ? props.toggle : undefined}
			>
				{props.item.title}
			</button>
			{props.children}
		</div>
	),
};

const section = (extra?: Partial<MenuItem>): MenuModel => [
	{
		title: "Components",
		href: "/components",
		items: [{ title: "Button", href: "/button" }],
		...extra,
	},
];

const header = () => screen.getByText("Components");

describe("<Menu>", () => {
	it("renders the tree and tags each level with its depth", () => {
		render(<Menu menu={section()} components={components} />);
		expect(header().closest("div")?.dataset.level).toBe("0");
		expect(screen.getByText("Button").closest("div")?.dataset.level).toBe("1");
	});

	it("collapses and re-expands a section on toggle", () => {
		render(<Menu menu={section()} components={components} />);
		expect(header().dataset.open).toBe("true");
		fireEvent.click(header());
		expect(header().dataset.open).toBe("false");
		fireEvent.click(header());
		expect(header().dataset.open).toBe("true");
	});

	it("honours `defaultOpen: false`", () => {
		render(
			<Menu menu={section({ defaultOpen: false })} components={components} />,
		);
		expect(header().dataset.open).toBe("false");
	});

	it("gives a `collapsible: false` group the static variant (no open/toggle)", () => {
		render(
			<Menu menu={section({ collapsible: false })} components={components} />,
		);
		expect(header().dataset.open).toBeUndefined();
		expect(screen.getByText("Button")).toBeDefined();
	});

	it("renders the `before`/`after` slots with the item's state", () => {
		const menu = section({
			before: (item, { level }) => (
				<span>{`before:${item.title}:${level}`}</span>
			),
			after: (_, { open }) => <span>{`after:${open}`}</span>,
		});
		render(<Menu menu={menu} components={components} />);
		expect(screen.getByText("before:Components:0")).toBeDefined();
		expect(screen.getByText("after:true")).toBeDefined();
	});
});
