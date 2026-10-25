// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Home, mountHome } from "./home";
import { fakeReducedMotion } from "./test-support/layout";
import { loadHomeBody } from "./test-support/page";

/** A stand-in for the IntersectionObserver of the browser, which happy-dom never fires. */
class FakeObserver {
	static all: FakeObserver[] = [];
	watched = new Set<Element>();
	constructor(readonly callback: IntersectionObserverCallback) {
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
}

/** The screen shows `el`, or hides it, to every observer that watches it. */
function show(el: Element, isIntersecting = true) {
	for (const observer of FakeObserver.all) {
		if (!observer.watched.has(el)) continue;
		const entry = { target: el, isIntersecting } as IntersectionObserverEntry;
		observer.callback([entry], observer as unknown as IntersectionObserver);
	}
}

let homes: Home[] = [];

function mount(): Home {
	const home = mountHome(document);
	homes.push(home);
	return home;
}

/** The first copy of the section: the one that assistive technology reads. */
function section(): HTMLElement {
	const found = document.querySelector<HTMLElement>("#demos");
	if (!found) throw new Error("no #demos");
	return found;
}

/** The section in the Twin copy. */
function twin(): HTMLElement {
	const found = document.querySelector<HTMLElement>('.vs-copy[aria-hidden="true"] [data-showcase]');
	if (!found) throw new Error("no Twin copy of the Demo stores");
	return found;
}

const tabs = (root: HTMLElement = section()) => [...root.querySelectorAll<HTMLButtonElement>(".tab")];
const cards = (root: HTMLElement = section()) => [...root.querySelectorAll<HTMLElement>(".store")];
const shown = (root: HTMLElement = section()) =>
	cards(root)
		.map((card) => card.querySelector("h3")?.textContent)
		.filter((_, k) => cards(root)[k].classList.contains("is-on"));
const selected = (root: HTMLElement = section()) =>
	tabs(root)
		.filter((tab) => tab.getAttribute("aria-selected") === "true")
		.map((tab) => tab.querySelector("b")?.textContent);

beforeEach(() => {
	loadHomeBody();
	localStorage.clear();
	FakeObserver.all = [];
	vi.stubGlobal("IntersectionObserver", FakeObserver);
});

afterEach(() => {
	for (const home of homes) home.dispose();
	homes = [];
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe("the store tiles", () => {
	it("show after the script runs, with the first store shown and the other cards out of reach", () => {
		mount();

		expect(section().querySelector<HTMLElement>(".tabs")?.hidden).toBe(false);
		expect(shown()).toEqual(["Café Serra"]);
		expect(selected()).toEqual(["Café Serra"]);
		expect(cards().map((card) => card.inert)).toEqual([false, true, true]);
		expect(tabs().map((tab) => tab.tabIndex)).toEqual([0, -1, -1]);
	});

	it("show the store of the tile that the visitor clicks", () => {
		mount();

		tabs()[2].click();

		expect(shown()).toEqual(["Orvalho"]);
		expect(selected()).toEqual(["Orvalho"]);
		expect(cards().map((card) => card.inert)).toEqual([true, true, false]);
		expect(tabs().map((tab) => tab.tabIndex)).toEqual([-1, -1, 0]);
	});

	it("move with the arrow keys, Home and End, and take the focus, with no transition", () => {
		mount();
		const key = (k: string) =>
			document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
		tabs()[0].focus();

		key("ArrowRight");
		expect(selected()).toEqual(["Ateliê Lume"]);
		expect(document.activeElement).toBe(tabs()[1]);
		expect(section().querySelector(".panels")?.classList.contains("is-instant")).toBe(true);

		key("ArrowLeft");
		key("ArrowLeft");
		expect(selected()).toEqual(["Orvalho"]);

		key("Home");
		expect(selected()).toEqual(["Café Serra"]);
		key("End");
		expect(selected()).toEqual(["Orvalho"]);
	});

	it("move on by themselves while the section is in view, until the visitor picks a store", () => {
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		mount();
		show(section().querySelector("[data-showcase]") as Element);

		vi.advanceTimersByTime(9000);
		expect(shown()).toEqual(["Ateliê Lume"]);
		expect(section().querySelector(".tabs")?.classList.contains("is-auto")).toBe(true);

		tabs()[0].click();
		vi.advanceTimersByTime(30000);
		expect(shown()).toEqual(["Café Serra"]);
		expect(section().querySelector(".tabs")?.classList.contains("is-auto")).toBe(false);
	});

	it("wait while the section is out of view", () => {
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		mount();

		vi.advanceTimersByTime(30000);

		expect(shown()).toEqual(["Café Serra"]);
	});

	it("never move by themselves with reduced motion", () => {
		fakeReducedMotion(true);
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		mount();
		show(section().querySelector("[data-showcase]") as Element);

		vi.advanceTimersByTime(30000);

		expect(shown()).toEqual(["Café Serra"]);
	});

	it("stop moving after dispose", () => {
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		const home = mount();
		show(section().querySelector("[data-showcase]") as Element);

		home.dispose();
		vi.advanceTimersByTime(30000);

		expect(shown()).toEqual(["Café Serra"]);
	});
});

describe("the store recordings", () => {
	function spyVideos() {
		const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
		const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
		return { play, pause };
	}

	it("play only on screen and only in the shown card", () => {
		const { play } = spyVideos();
		mount();
		const [laptop, phone] = cards()[0].querySelectorAll("video");
		const hidden = cards()[1].querySelector("video") as HTMLVideoElement;

		show(laptop);
		show(phone);
		show(hidden);

		// happy-dom keeps `paused` true, so a video can be asked to play more than once.
		expect([...new Set(play.mock.contexts)]).toEqual([laptop, phone]);
		expect(laptop.preload).toBe("auto");
	});

	it("never play with reduced motion", () => {
		fakeReducedMotion(true);
		const { play } = spyVideos();
		mount();

		for (const video of cards()[0].querySelectorAll("video")) show(video);

		expect(play).not.toHaveBeenCalled();
	});
});

describe("the password", () => {
	it("goes to the clipboard, and the button shows Copied with its check, then Copy again", async () => {
		const write = vi.fn(() => Promise.resolve());
		vi.spyOn(navigator.clipboard, "writeText").mockImplementation(write);
		mount();
		vi.useFakeTimers({ toFake: ["setTimeout"] });
		const button = cards()[1].querySelector<HTMLButtonElement>("[data-copy]") as HTMLButtonElement;

		button.click();
		await vi.advanceTimersByTimeAsync(0);

		expect(write).toHaveBeenCalledWith("lume");
		expect(button.textContent).toBe("Copied");
		expect(button.classList.contains("is-done")).toBe(true);
		expect(button.querySelectorAll("svg")).toHaveLength(2);

		await vi.advanceTimersByTimeAsync(1600);
		expect(button.textContent).toBe("Copy");
		expect(button.classList.contains("is-done")).toBe(false);
	});
});

describe("the Twin copy of the Demo stores", () => {
	it("has no ids and no tab stops, also after the visitor picks a store", () => {
		mount();
		tabs(twin())[1].click();
		tabs()[2].click();

		expect(twin().querySelectorAll("[id]")).toHaveLength(0);
		const focusable = twin().querySelectorAll<HTMLElement>("a[href], button, input, textarea, select, [tabindex]");
		expect(focusable.length).toBeGreaterThan(0);
		for (const el of focusable) expect(el.tabIndex, el.outerHTML.slice(0, 60)).toBe(-1);
		expect(shown(twin())).toEqual(["Ateliê Lume"]);
	});
});
