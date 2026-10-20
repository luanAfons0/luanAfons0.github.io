// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Home, mountHome } from "./home";
import { fakeFrames, fakeLayout, fakeReducedMotion } from "./test-support/layout";
import { loadHomeBody } from "./test-support/page";

let homes: Home[] = [];

beforeEach(() => {
	loadHomeBody();
	localStorage.clear();
	history.replaceState(null, "", "/");
	fakeReducedMotion(true);
	// One copy of the page is 4000px high. Each section starts at a round part of it.
	fakeLayout({
		".vs-copy": { height: 4000 },
		".nav": { height: 64 },
		"#packages": { top: 400 },
		"#builder": { top: 1000 },
		"#process": { top: 1600 },
		"#demos": { top: 2000 },
		"#faq": { top: 3000 },
		"#contact": { top: 3200 },
	});
});

afterEach(() => {
	for (const home of homes) home.dispose();
	homes = [];
	vi.restoreAllMocks();
});

const fill = () => document.querySelector<HTMLElement>(".map-fill")?.style.transform;

describe("the Page map", () => {
	it("has one tick per section, at the place of the section in the loop", () => {
		fakeFrames();
		homes.push(mountHome(document));

		const ticks = [...document.querySelectorAll<HTMLElement>(".map > .map-tick")].map((tick) => tick.style.left);

		expect(ticks).toEqual(["10%", "25%", "40%", "50%", "75%", "80%"]);
	});

	it("fills with the position in the loop", () => {
		const frames = fakeFrames();
		homes.push(mountHome(document));
		frames.frame();
		expect(fill()).toBe("scaleX(0)");

		window.dispatchEvent(new WheelEvent("wheel", { deltaY: 1000, cancelable: true }));
		frames.frame();
		expect(fill()).toBe("scaleX(0.25)");

		window.dispatchEvent(new WheelEvent("wheel", { deltaY: -2000, cancelable: true }));
		frames.frame();
		expect(fill()).toBe("scaleX(0.75)");
	});

	it("puts the ticks again, not more of them, when the page is measured again", () => {
		fakeFrames();
		homes.push(mountHome(document));

		window.dispatchEvent(new Event("resize"));

		expect(document.querySelectorAll(".map-tick")).toHaveLength(6);
	});
});
