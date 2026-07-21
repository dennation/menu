import type { MenuOpenState } from "./Menu";

/**
 * A tiny external store for a menu's disclosure state and active item, read
 * per-node via `useSyncExternalStore`. Its identity is stable, so a change
 * notifies only the nodes whose own value changed — a toggle wakes one section,
 * a navigation wakes just the old and new active items — not the whole tree. It
 * lets `useMenu` own the state without lifting it into React state (which would
 * re-render the consumer on every change). `onChange` fires on disclosure
 * changes, for persistence.
 */
export interface MenuStateStore {
	subscribe(listener: () => void): () => void;
	/** Open state of `id`, falling back to the item's default. */
	isOpen(id: string, fallback: boolean): boolean;
	getState(): MenuOpenState;
	set(id: string, value: boolean): void;
	/** Flip `id` (using `fallback` for its current value). */
	toggle(id: string, fallback: boolean): void;
	/** Apply many changes at once (e.g. expand an active branch). */
	merge(patch: MenuOpenState): void;
	/** Whether `id` is the active item. */
	isActive(id: string): boolean;
	/** Whether the active item is in `id`'s subtree (`id` is its ancestor). */
	containsActive(id: string): boolean;
	getActiveId(): string | undefined;
	setActive(id: string | undefined): void;
	/** Set the active item's ancestor ids (the trail minus the active item). */
	setActiveAncestors(ids: string[]): void;
}

export function createMenuStateStore(
	initial: MenuOpenState,
	onChange?: (next: MenuOpenState) => void,
): MenuStateStore {
	let state = initial;
	let activeId: string | undefined;
	let activeAncestors = new Set<string>();
	const listeners = new Set<() => void>();
	const notify = () => {
		for (const listener of listeners) listener();
	};

	// The one disclosure mutator: skip no-op patches, then swap state and notify.
	// `set` and `toggle` are just single-key merges.
	const merge = (patch: MenuOpenState) => {
		if (Object.keys(patch).every((id) => state[id] === patch[id])) return;
		state = { ...state, ...patch };
		notify();
		onChange?.(state);
	};

	return {
		subscribe(listener) {
			listeners.add(listener);
			return () => void listeners.delete(listener);
		},
		isOpen: (id, fallback) => state[id] ?? fallback,
		getState: () => state,
		set: (id, value) => merge({ [id]: value }),
		toggle: (id, fallback) => merge({ [id]: !(state[id] ?? fallback) }),
		merge,
		isActive: (id) => activeId === id,
		containsActive: (id) => activeAncestors.has(id),
		getActiveId: () => activeId,
		setActive(id) {
			if (activeId === id) return;
			activeId = id;
			notify();
		},
		setActiveAncestors(ids) {
			activeAncestors = new Set(ids);
			notify();
		},
	};
}
