// The Virtual scroll and the Twin copy (mock lines 856–965).
// STUB until #57: the page scrolls normally, there is no Twin copy, and frame hooks never run.

/** A function that runs on each animation frame where the position changes. `m` is the position in the loop, 0..len. */
export interface FrameHook {
	(m: number): void;
	/** Runs once when the hook is added, and again each time the Virtual scroll measures the page. */
	measure?(): void;
}

/** The small surface of the Virtual scroll that the other parts of the page use (mock line 964). */
export interface Scroll {
	/** The y of `el` inside the first copy of the page. */
	topOf(el: HTMLElement): number;
	/** The height of one copy of the page: the length of the loop. */
	len(): number;
	/** Adds a frame hook. It runs `hook.measure?.()` at once. */
	onFrame(hook: FrameHook): void;
	/** The last scroll direction: 1 down, -1 up. */
	dir(): 1 | -1;
}

/**
 * Starts the Virtual scroll: builds the Twin copy, then moves the page on wheel, touch and keys.
 * It runs before any other part of the page, so that each later query also reaches the Twin copy.
 * Every listener, observer and animation frame loop stops when `signal` aborts.
 */
export function mountScroll(_doc: Document, _signal: AbortSignal): Scroll {
	return {
		topOf(el) {
			let y = 0;
			for (let node: HTMLElement | null = el; node; node = node.offsetParent as HTMLElement | null) y += node.offsetTop;
			return y;
		},
		len: () => 1,
		onFrame(hook) {
			hook.measure?.();
		},
		dir: () => 1,
	};
}
