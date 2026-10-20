// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Home, mountHome } from "./home";
import { fakeFrames, fakeLayout, fakeReducedMotion } from "./test-support/layout";
import { loadHomeBody } from "./test-support/page";

let homes: Home[] = [];

// The view is 768px high (happy-dom). One copy of the page is 6000px. The Filmstrip starts at 1000px, is 2000px high,
// and its stops are 400px apart. The reading line is at 0.75 of the view, and the first stop is at 0.5 of the view
// under the top of the Filmstrip, so the Frame changes at a position of 808, 1208, 1608 and 2008.
const LAYOUT = {
	".vs-copy": { height: 6000 },
	".nav": { height: 64 },
	"#services": { top: 1000, height: 2000 },
	'.fs-stop[style*="--k:0"]': { top: 0, height: 400 },
	'.fs-stop[style*="--k:1"]': { top: 400, height: 400 },
	'.fs-stop[style*="--k:2"]': { top: 800, height: 400 },
	'.fs-stop[style*="--k:3"]': { top: 1200, height: 400 },
};

/** A position inside the stop of each Frame. */
const AT = [908, 1308, 1708, 2108];

function mount(): Home {
	const home = mountHome(document);
	homes.push(home);
	return home;
}

/** The elements of the Filmstrip in the first copy: the Twin copy is hidden from assistive technology. */
function own(selector: string): HTMLElement[] {
	return [...document.querySelectorAll<HTMLElement>(`#services ${selector}`)].filter(
		(el) => !el.closest('.vs-copy[aria-hidden="true"]'),
	);
}

function indexOf(selector: string): number[] {
	return own(selector).flatMap((el, k) => (el.classList.contains("is-active") ? [k] : []));
}

/** What the Filmstrip shows: the active Frame, the shown Chapter, and the state of each Timeline tick. */
function shown() {
	return {
		frame: indexOf(".frame"),
		chapter: indexOf(".chapter"),
		ticks: own(".tl-tick").map((tick) =>
			tick.classList.contains("is-active") ? "active" : tick.classList.contains("is-done") ? "done" : "",
		),
	};
}

function showing(i: number) {
	return {
		frame: [i],
		chapter: [i],
		ticks: [0, 1, 2, 3].map((k) => (k === i ? "active" : k < i ? "done" : "")),
	};
}

function wheel(deltaY: number): void {
	window.dispatchEvent(new WheelEvent("wheel", { deltaY, cancelable: true }));
}

beforeEach(() => {
	loadHomeBody();
	localStorage.clear();
	history.replaceState(null, "", "/");
	fakeLayout(LAYOUT);
});

afterEach(() => {
	for (const home of homes) home.dispose();
	homes = [];
	vi.restoreAllMocks();
});

describe("the Filmstrip with the Virtual scroll", () => {
	beforeEach(() => fakeReducedMotion(false));

	/** Moves the page by `dy` and runs the animation frames until the eased scroll stops. */
	function scrollBy(frames: ReturnType<typeof fakeFrames>, dy: number): void {
		wheel(dy);
		for (let k = 0; k < 100; k++) frames.frame(64);
	}

	it("makes the Frame of the stop under the reading line active", () => {
		const frames = fakeFrames();
		mount();

		scrollBy(frames, AT[1]);
		expect(shown()).toEqual(showing(1));

		scrollBy(frames, AT[3] - AT[1]);
		expect(shown()).toEqual(showing(3));

		scrollBy(frames, AT[2] - AT[3]);
		expect(shown()).toEqual(showing(2));
	});

	it("lights the first Frame, Chapter and tick on load", () => {
		const frames = fakeFrames();
		mount();
		frames.frame();

		expect(shown()).toEqual(showing(0));
	});

	it("settles each Frame whole: a whole step from the active Frame, never between", () => {
		const frames = fakeFrames();
		mount();

		scrollBy(frames, AT[2] + 150);

		const fan = own(".frame").map((frame) => [
			frame.style.getPropertyValue("--d"),
			frame.style.getPropertyValue("--ad"),
			frame.style.zIndex,
		]);
		expect(fan).toEqual([
			["-2", "2", "8"],
			["-1", "1", "9"],
			["0", "0", "10"],
			["1", "1", "9"],
		]);
	});

	describe("out of view", () => {
		/** Records each class of the Filmstrip that is gone, so that a test sees a class that came and went at once. */
		function watchClass() {
			const fs = document.getElementById("services") as HTMLElement;
			const records = new MutationObserver(() => {});
			records.observe(fs, { attributes: true, attributeFilter: ["class"], attributeOldValue: true });
			return {
				/** True when the Filmstrip had `.is-jump` since the last call, and has it no more. */
				jumped() {
					const had = records.takeRecords().some((record) => record.oldValue?.split(" ").includes("is-jump"));
					return had && !fs.classList.contains("is-jump");
				},
			};
		}

		it("waits on the first Frame, at once, when the page goes on down past it", () => {
			const frames = fakeFrames();
			mount();
			scrollBy(frames, AT[2]);
			const fs = watchClass();

			scrollBy(frames, 1800);

			expect(shown()).toEqual(showing(0));
			expect(fs.jumped()).toBe(true);
		});

		it("waits on the last Frame, at once, when the page goes back up past it", () => {
			const frames = fakeFrames();
			mount();
			scrollBy(frames, 3500);
			const fs = watchClass();

			scrollBy(frames, -100);
			expect(shown()).toEqual(showing(3));
			expect(fs.jumped()).toBe(true);

			// Back in view from below: the last Frame shows with no jump.
			scrollBy(frames, -600);
			expect(shown()).toEqual(showing(3));
			expect(fs.jumped()).toBe(false);
		});

		it("waits on the last Frame when the page comes round from below through the loop seam", () => {
			const frames = fakeFrames();
			mount();
			frames.frame();
			const fs = watchClass();

			scrollBy(frames, -500);
			expect(shown()).toEqual(showing(3));
			expect(fs.jumped()).toBe(true);

			scrollBy(frames, -3000);
			expect(shown()).toEqual(showing(3));
			scrollBy(frames, -500);
			expect(shown()).toEqual(showing(2));
			expect(fs.jumped()).toBe(false);
		});

		it("steps in view with the transitions on", () => {
			const frames = fakeFrames();
			mount();
			scrollBy(frames, AT[0]);
			const fs = watchClass();

			scrollBy(frames, AT[1] - AT[0]);

			expect(shown()).toEqual(showing(1));
			expect(fs.jumped()).toBe(false);
		});
	});
});

describe("the Filmstrip as a swipe row (phones and reduced motion)", () => {
	/** A stand-in for the IntersectionObserver of the browser, which happy-dom never fires. */
	class FakeObserver {
		static all: FakeObserver[] = [];
		watched = new Set<Element>();
		constructor(
			readonly callback: IntersectionObserverCallback,
			readonly options: IntersectionObserverInit = {},
		) {
			FakeObserver.all.push(this);
		}
		observe(el: Element) {
			this.watched.add(el);
		}
		unobserve(el: Element) {
			this.watched.delete(el);
		}
		disconnect() {
			this.watched.clear();
		}
		takeRecords() {
			return [];
		}
		/** The swipe row shows `el`, or hides it. */
		show(el: Element, isIntersecting = true) {
			if (!this.watched.has(el)) return;
			const entry = { target: el, isIntersecting } as IntersectionObserverEntry;
			this.callback([entry], this as unknown as IntersectionObserver);
		}
	}

	beforeEach(() => {
		fakeReducedMotion(true);
		FakeObserver.all = [];
		vi.stubGlobal("IntersectionObserver", FakeObserver);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	/** Shows the Frame `i` of the swipe row to every observer. */
	function swipeTo(i: number) {
		const frame = own(".frame")[i];
		for (const observer of FakeObserver.all) observer.show(frame);
	}

	it("makes the Frame that the swipe row shows active, with its Chapter and tick", () => {
		fakeFrames();
		mount();

		swipeTo(2);
		expect(shown()).toEqual(showing(2));

		swipeTo(1);
		expect(shown()).toEqual(showing(1));
	});

	it("watches the Frames inside the row, when most of a Frame shows", () => {
		fakeFrames();
		mount();

		const watching = FakeObserver.all.filter((observer) => observer.watched.size > 0);
		expect(watching).toHaveLength(1);
		expect([...watching[0].watched]).toEqual(own(".frame"));
		expect(watching[0].options.root).toBe(own(".fan")[0]);
		expect(watching[0].options.threshold).toBe(0.6);
	});

	it("does not take the Frame from the scroll", () => {
		const frames = fakeFrames();
		mount();
		swipeTo(1);

		wheel(AT[3]);
		frames.frame();
		wheel(3500);
		frames.frame();

		expect(shown()).toEqual(showing(1));
	});

	it("stops watching the row when the page is disposed", () => {
		fakeFrames();
		mount().dispose();

		expect(FakeObserver.all.every((observer) => observer.watched.size === 0)).toBe(true);
	});
});

describe("the Chapters", () => {
	it("change inside one polite live region, which assistive technology reads in the first copy only", () => {
		fakeReducedMotion(false);
		fakeFrames();
		mount();

		const regions = own(".chapters");
		expect(regions).toHaveLength(1);
		expect(regions[0].getAttribute("aria-live")).toBe("polite");
		expect(own(".chapter")).toHaveLength(4);
		expect(own(".chapter").every((chapter) => regions[0].contains(chapter))).toBe(true);
	});
});
