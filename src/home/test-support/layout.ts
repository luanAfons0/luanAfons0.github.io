import { onTestFinished, vi } from "vitest";

/** The box of one element in the test layout: its y inside the first copy of the page, and its height. */
export interface Box {
	top?: number;
	height?: number;
}

/**
 * Gives happy-dom a layout, because happy-dom lays out nothing (every height is 0). Each key is a selector, and
 * each element that matches it gets that box. An element with a `top` has the first copy of the page
 * (`.vs-copy`) as its offset parent, so its `top` is its y inside that copy. `getBoundingClientRect` gives the same
 * box, with the copy at y 0.
 */
export function fakeLayout(boxes: Record<string, Box>): void {
	const boxOf = (el: HTMLElement): Box | undefined => {
		for (const [selector, box] of Object.entries(boxes)) if (el.matches(selector)) return box;
		return undefined;
	};
	vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
		return boxOf(this)?.height ?? 0;
	});
	vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockImplementation(function (this: HTMLElement) {
		return boxOf(this)?.top ?? 0;
	});
	vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
		const box = boxOf(this);
		return new DOMRect(0, box?.top ?? 0, 0, box?.height ?? 0);
	});
	// happy-dom has no offsetParent, so the test defines it, and takes it away when the test ends.
	const own = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetParent");
	Object.defineProperty(HTMLElement.prototype, "offsetParent", {
		configurable: true,
		get(this: HTMLElement) {
			return boxOf(this)?.top === undefined ? null : (this.parentElement?.closest(".vs-copy") ?? null);
		},
	});
	onTestFinished(() => {
		if (own) Object.defineProperty(HTMLElement.prototype, "offsetParent", own);
		else delete (HTMLElement.prototype as { offsetParent?: unknown }).offsetParent;
	});
}

/**
 * Takes over the animation frames and the clock of `win`, so that a test runs each frame by hand.
 * `frame(ms)` moves the clock on by `ms` and runs the frames that wait.
 */
export function fakeFrames(win: Window & typeof globalThis = window) {
	let now = 1000;
	let next = 1;
	const waiting = new Map<number, FrameRequestCallback>();
	vi.spyOn(win.performance, "now").mockImplementation(() => now);
	vi.spyOn(win, "requestAnimationFrame").mockImplementation((fn) => {
		waiting.set(next, fn);
		return next++;
	});
	vi.spyOn(win, "cancelAnimationFrame").mockImplementation((id) => {
		waiting.delete(id);
	});
	return {
		frame(ms = 16) {
			now += ms;
			const due = [...waiting.values()];
			waiting.clear();
			for (const fn of due) fn(now);
		},
		/** The number of frames that wait to run. */
		waiting: () => waiting.size,
	};
}

/** Makes `prefers-reduced-motion: reduce` match, or not. Every other query does not match. */
export function fakeReducedMotion(reduce: boolean, win: Window & typeof globalThis = window): void {
	vi.spyOn(win, "matchMedia").mockImplementation(
		(media) =>
			({
				media,
				matches: reduce && media.includes("prefers-reduced-motion: reduce"),
				onchange: null,
				addEventListener() {},
				removeEventListener() {},
				addListener() {},
				removeListener() {},
				dispatchEvent: () => false,
			}) as MediaQueryList,
	);
}
