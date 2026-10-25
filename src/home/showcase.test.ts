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

/** The stores of the first copy of the section: the ones that assistive technology reads. */
const stores = () => [...document.querySelectorAll<HTMLElement>("#demos .store")];

/** The stores in the Twin copy. */
function twin(): HTMLElement {
	const found = document.querySelector<HTMLElement>('.vs-copy[aria-hidden="true"] [data-showcase]');
	if (!found) throw new Error("no Twin copy of the Demo stores");
	return found;
}

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

describe("the store recordings", () => {
	function spyVideos() {
		const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
		vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
		return play;
	}

	it("play only while they are on screen", () => {
		const play = spyVideos();
		mount();
		const [laptop, phone] = stores()[0].querySelectorAll("video");
		const below = stores()[2].querySelector("video") as HTMLVideoElement;

		show(laptop);
		show(phone);
		show(below, false);

		// happy-dom keeps `paused` true, so a video can be asked to play more than once.
		expect([...new Set(play.mock.contexts)]).toEqual([laptop, phone]);
		expect(laptop.preload).toBe("auto");
		expect(below.preload).toBe("none");
	});

	it("never play with reduced motion", () => {
		fakeReducedMotion(true);
		const play = spyVideos();
		mount();

		for (const video of stores()[0].querySelectorAll("video")) show(video);

		expect(play).not.toHaveBeenCalled();
	});

	it("stop being watched after dispose", () => {
		mount().dispose();

		expect(FakeObserver.all.every((observer) => observer.watched.size === 0)).toBe(true);
	});
});

describe("the password", () => {
	it("goes to the clipboard, and the button shows Copied with its check, then Copy again", async () => {
		const write = vi.fn(() => Promise.resolve());
		vi.spyOn(navigator.clipboard, "writeText").mockImplementation(write);
		mount();
		vi.useFakeTimers({ toFake: ["setTimeout"] });
		const button = stores()[1].querySelector<HTMLButtonElement>("[data-copy]") as HTMLButtonElement;

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
	it("has no ids and no tab stops", () => {
		mount();

		expect(twin().querySelectorAll("[id]")).toHaveLength(0);
		expect(twin().querySelectorAll("[aria-labelledby]")).toHaveLength(0);
		const focusable = twin().querySelectorAll<HTMLElement>("a[href], button, [tabindex]");
		expect(focusable.length).toBeGreaterThan(0);
		for (const el of focusable) expect(el.tabIndex, el.outerHTML.slice(0, 60)).toBe(-1);
	});
});
