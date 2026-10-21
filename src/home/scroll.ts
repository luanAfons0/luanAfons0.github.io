// The Virtual scroll and the Twin copy (mock lines 771–881).
// The page does not scroll. Wheel, touch and keys move a target, and each frame eases the track toward it.
// The track holds the page two times, and the offset wraps at the height of one copy, so the end flows into the start.

/** A function that runs on each animation frame where the position changes. `m` is the position in the loop, 0..len. */
export interface FrameHook {
	(m: number): void;
	/** Runs once when the hook is added, and again each time the Virtual scroll measures the page. */
	measure?(): void;
}

/** The small surface of the Virtual scroll that the other parts of the page use (mock line 880). */
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

/** The elements that can take the focus. In the Twin copy, each one gets `tabIndex = -1`. */
const CONTROLS = "a, button, input, textarea, summary";

/** The fields where the keys type text: the Virtual scroll leaves every key there to the browser. */
const TYPING = "input, textarea, select, [contenteditable]";

/** How far each key moves the page, from the page step (the view under the nav, less 48px). */
const KEY_STEPS: Partial<Record<string, (page: number, shift: boolean) => number>> = {
	ArrowDown: () => 80,
	ArrowUp: () => -80,
	PageDown: (page) => page,
	PageUp: (page) => -page,
	" ": (page, shift) => (shift ? -page : page),
};

function windowOf(doc: Document): Window & typeof globalThis {
	if (!doc.defaultView) throw new Error("mountScroll needs a document with a window");
	return doc.defaultView;
}

function find<E extends HTMLElement>(doc: Document, selector: string): E {
	const el = doc.querySelector<E>(selector);
	if (!el) throw new Error(`mountScroll needs a ${selector} element`);
	return el;
}

/** Moves `main` and the footer into the first copy, and makes the Twin copy from it (mock lines 774–783). */
function buildView(doc: Document, signal: AbortSignal) {
	const nav = find(doc, ".nav");
	const view = doc.createElement("div");
	const track = doc.createElement("div");
	const copy = doc.createElement("div");
	view.className = "vs";
	track.className = "vs-track";
	copy.className = "vs-copy";
	copy.append(find(doc, "main"), find(doc, ".foot"));

	const twin = copy.cloneNode(true) as HTMLElement;
	twin.setAttribute("aria-hidden", "true");
	for (const el of twin.querySelectorAll("[id]")) el.removeAttribute("id");
	for (const el of twin.querySelectorAll("[for], [aria-labelledby]")) {
		el.removeAttribute("for");
		el.removeAttribute("aria-labelledby");
	}
	for (const el of twin.querySelectorAll(".fs-stop")) el.remove();
	for (const el of twin.querySelectorAll<HTMLElement>(CONTROLS)) el.tabIndex = -1;
	twin.addEventListener("submit", (e) => e.preventDefault(), { signal });

	track.append(copy, twin);
	view.append(track);
	nav.after(view);
	doc.documentElement.classList.add("vs-on");
	return { nav, view, track, copy };
}

/**
 * Starts the Virtual scroll: builds the Twin copy, then moves the page on wheel, touch and keys.
 * It runs before any other part of the page, so that each later query also reaches the Twin copy.
 * Every listener, observer and animation frame loop stops when `signal` aborts.
 */
export function mountScroll(doc: Document, signal: AbortSignal): Scroll {
	const win = windowOf(doc);
	const { nav, view, track, copy } = buildView(doc, signal);
	const on = { signal };

	const still = win.matchMedia("(prefers-reduced-motion: reduce)");
	const hooks: FrameHook[] = [];
	let target = 0;
	let current = 0;
	let shown = Number.NaN;
	let last = win.performance.now();
	// happy-dom lays out nothing, so a copy can be 0px high; 1 keeps the wrap a number.
	let len = 1;
	let dir: 1 | -1 = 1;
	let stickies: Sticky[] = [];

	const navH = () => nav.offsetHeight;
	const wrap = (y: number) => ((y % len) + len) % len;
	const topOf = (el: HTMLElement) => {
		let y = 0;
		for (let node: HTMLElement | null = el; node && node !== copy; node = node.offsetParent as HTMLElement | null)
			y += node.offsetTop;
		return y;
	};
	const move = (dy: number) => {
		target += dy;
		if (dy) dir = dy > 0 ? 1 : -1;
	};

	// position: sticky has no effect in a page that does not scroll, so each frame places the sticky blocks by hand.
	function measure() {
		len = copy.offsetHeight || 1;
		const marked = [...copy.querySelectorAll<HTMLElement>("[data-sticky]")];
		for (const el of marked) el.style.transform = "";
		// The exact layout box, not the whole pixels of offsetTop: a lost fraction moves the block off the pixel grid.
		const origin = copy.getBoundingClientRect().top;
		const box = (el: HTMLElement) => {
			const r = el.getBoundingClientRect();
			return { top: r.top - origin, bottom: r.bottom - origin };
		};
		stickies = marked
			.filter((el) => win.getComputedStyle(el).position === "sticky")
			.map((el) => {
				const own = box(el);
				const parent = box(el.parentElement as HTMLElement);
				return {
					el,
					at: Number.parseFloat(win.getComputedStyle(el).top) || 0,
					top: own.top,
					max: parent.bottom - own.bottom,
				};
			});
		shown = Number.NaN;
		for (const hook of hooks) hook.measure?.();
	}

	let raf = 0;
	function frame(now: number) {
		const dt = Math.min(now - last, 64) / 1000;
		last = now;
		current =
			still.matches || Math.abs(target - current) < 0.1
				? target
				: current + (target - current) * (1 - Math.exp(-dt * 8));
		// Snap to whole device pixels: a fraction rounds one way in the track and the other way in a sticky block,
		// so the sticky block shakes by one pixel.
		const dpr = win.devicePixelRatio || 1;
		const m = Math.round(wrap(current) * dpr) / dpr;
		if (m !== shown) {
			shown = m;
			track.style.transform = `translate3d(0, ${-m}px, 0)`;
			for (const k of stickies)
				k.el.style.transform = `translateY(${Math.max(0, Math.min(m + k.at - k.top, k.max))}px)`;
			for (const hook of hooks) hook(m);
		}
		raf = win.requestAnimationFrame(frame);
	}

	// Go the short way round: forward through the seam when that is nearer.
	function goTo(el: HTMLElement, at = navH()) {
		let d = topOf(el) - at - wrap(target);
		if (d > len / 2) d -= len;
		else if (d < -len / 2) d += len;
		move(d);
	}

	win.addEventListener(
		"wheel",
		(e) => {
			if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
			e.preventDefault();
			move(e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? win.innerHeight : 1));
		},
		{ passive: false, signal },
	);

	// Touch: drag with the finger, then run on with the speed of the swipe. A horizontal swipe stays with the browser.
	let ty: number | null = null;
	let tx = 0;
	let tt = 0;
	let vy = 0;
	let lock: "x" | "y" | null = null;
	view.addEventListener(
		"touchstart",
		(e) => {
			({ clientX: tx, clientY: ty } = e.touches[0]);
			tt = e.timeStamp;
			vy = 0;
			lock = null;
		},
		{ passive: true, signal },
	);
	view.addEventListener(
		"touchmove",
		(e) => {
			if (ty === null) return;
			const { clientX: x, clientY: y } = e.touches[0];
			const dy = ty - y;
			if (!lock) {
				if (Math.abs(dy) + Math.abs(tx - x) < 6) return;
				lock = Math.abs(dy) > Math.abs(tx - x) ? "y" : "x";
			}
			if (lock !== "y") return;
			vy = (0.8 * dy) / Math.max(e.timeStamp - tt, 1) + 0.2 * vy;
			ty = y;
			tx = x;
			tt = e.timeStamp;
			move(dy);
			current = target;
		},
		{ passive: true, signal },
	);
	view.addEventListener(
		"touchend",
		() => {
			if (lock === "y") move(vy * 300);
			ty = null;
		},
		{ passive: true, signal },
	);

	win.addEventListener(
		"keydown",
		(e) => {
			const at = e.target instanceof Element ? e.target : null;
			if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || at?.closest(TYPING)) return;
			if (e.key === " " && at?.closest("a, button, summary")) return;
			const page = win.innerHeight - navH() - 48;
			const d = KEY_STEPS[e.key]?.(page, e.shiftKey);
			if (e.key === "Home") {
				e.preventDefault();
				move(-wrap(target));
			} else if (e.key === "End") {
				e.preventDefault();
				move(len - win.innerHeight - wrap(target));
			} else if (d !== undefined) {
				e.preventDefault();
				move(d);
			}
		},
		on,
	);

	doc.addEventListener(
		"click",
		(e) => {
			const a = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>('a[href^="#"]') : null;
			const el = a && doc.getElementById(a.hash.slice(1));
			if (!a || !el) return;
			e.preventDefault();
			if (!el.matches(CONTROLS)) el.tabIndex = -1;
			el.focus({ preventScroll: true });
			goTo(el);
			try {
				win.history.replaceState(null, "", a.hash);
			} catch {
				// A page in a sandbox can have no history: the link still moves the page.
			}
		},
		on,
	);

	// Tab and form errors move the focus; bring the focused element into view.
	doc.addEventListener(
		"focusin",
		(e) => {
			const el = e.target;
			if (!(el instanceof win.HTMLElement) || !copy.contains(el)) return;
			const r = el.getBoundingClientRect();
			const top = navH();
			if (r.top >= top && r.bottom <= win.innerHeight) return;
			goTo(el, r.height > win.innerHeight - top - 32 ? top : Math.max(top + 16, (win.innerHeight - r.height) / 2));
		},
		on,
	);

	const resizes = new win.ResizeObserver(measure);
	resizes.observe(copy);
	win.addEventListener("resize", measure, on);
	measure();
	const start = win.location.hash && doc.getElementById(win.location.hash.slice(1));
	if (start) target = current = topOf(start) - navH();
	raf = win.requestAnimationFrame(frame);
	signal.addEventListener(
		"abort",
		() => {
			win.cancelAnimationFrame(raf);
			resizes.disconnect();
		},
		{ once: true },
	);

	return {
		topOf,
		len: () => len,
		onFrame(hook) {
			hooks.push(hook);
			hook.measure?.();
		},
		dir: () => dir,
	};
}

/** A sticky block: `at` is its CSS `top`, `top` its y in the copy, `max` how far it can move in its parent. */
interface Sticky {
	el: HTMLElement;
	at: number;
	top: number;
	max: number;
}
