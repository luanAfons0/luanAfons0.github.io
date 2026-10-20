// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Home, mountHome } from "./home";
import { mountScroll, type Scroll } from "./scroll";
import { fakeFrames, fakeLayout, fakeReducedMotion } from "./test-support/layout";
import { loadHomeBody } from "./test-support/page";

let controllers: AbortController[] = [];
let homes: Home[] = [];

function mount(): Scroll {
	const controller = new AbortController();
	controllers.push(controller);
	return mountScroll(document, controller.signal);
}

function el<E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document): E {
	const found = root.querySelector<E>(selector);
	if (!found) throw new Error(`no ${selector}`);
	return found;
}

beforeEach(() => {
	loadHomeBody();
	localStorage.clear();
	history.replaceState(null, "", "/");
});

afterEach(() => {
	for (const controller of controllers) controller.abort();
	for (const home of homes) home.dispose();
	controllers = [];
	homes = [];
	vi.restoreAllMocks();
});

describe("the Twin copy", () => {
	it("puts the page two times in a fixed view after the nav, and marks the root", () => {
		homes.push(mountHome(document));

		const view = el(".vs");
		expect(view.previousElementSibling).toBe(el(".nav"));
		const copies = [...view.querySelectorAll(":scope > .vs-track > .vs-copy")];
		expect(copies).toHaveLength(2);
		expect(copies[0].querySelector(":scope > main")).toBe(el("main"));
		expect(copies[0].querySelector(":scope > .foot")).not.toBeNull();
		expect(copies[1].querySelector(":scope > main")).not.toBeNull();
		expect(copies[1].querySelector(":scope > .foot")).not.toBeNull();
		expect(document.documentElement.classList.contains("vs-on")).toBe(true);
	});

	it("has no ids, no labelled-by links and no tab stops, and is hidden from assistive technology", () => {
		homes.push(mountHome(document));
		const twin = document.querySelectorAll<HTMLElement>(".vs-copy")[1];

		expect(twin.getAttribute("aria-hidden")).toBe("true");
		expect(twin.querySelectorAll("[id]")).toHaveLength(0);
		expect(twin.querySelectorAll("[for], [aria-labelledby]")).toHaveLength(0);
		expect(twin.querySelectorAll(".fs-stop")).toHaveLength(0);
		const controls = [...twin.querySelectorAll<HTMLElement>("a, button, input, textarea, select, summary, [tabindex]")];
		expect(controls.length).toBeGreaterThan(20);
		for (const control of controls) expect(control.tabIndex, control.outerHTML.slice(0, 80)).toBe(-1);
		// The first copy keeps its ids, links and tab stops.
		expect(el("#contact").closest(".vs-copy")).toBe(document.querySelector(".vs-copy"));
		expect(el(".nav-links a").tabIndex).toBe(0);
	});

	it("does not send a form of the Twin copy", () => {
		mount();
		const twin = document.querySelectorAll<HTMLElement>(".vs-copy")[1];
		const form = el<HTMLFormElement>("form", twin);
		const submit = new Event("submit", { bubbles: true, cancelable: true });

		form.dispatchEvent(submit);

		expect(submit.defaultPrevented).toBe(true);
	});
});

/** One copy of the page is 5000px high, and the nav is 64px high. */
const LAYOUT = {
	".vs-copy": { height: 5000 },
	".nav": { height: 64 },
	"#packages": { top: 1000, height: 600 },
	"#faq": { top: 4000, height: 500 },
};

/** The position that the track shows: how far the page has moved inside the loop. */
function position(): number {
	const match = /translate3d\(0, (-?[\d.]+)px, 0\)/.exec(el(".vs-track").style.transform);
	if (!match) throw new Error(`no position in "${el(".vs-track").style.transform}"`);
	return 0 - Number(match[1]);
}

function wheel(deltaY: number, init: WheelEventInit = {}): WheelEvent {
	const event = new WheelEvent("wheel", { deltaY, bubbles: true, cancelable: true, ...init });
	// The WheelEvent of happy-dom has no modifier keys.
	Object.defineProperty(event, "ctrlKey", { value: init.ctrlKey ?? false });
	window.dispatchEvent(event);
	return event;
}

describe("the wheel", () => {
	it("moves the page at once with reduced motion", () => {
		fakeLayout(LAYOUT);
		fakeReducedMotion(true);
		const frames = fakeFrames();
		mount();

		const event = wheel(120);
		frames.frame();

		expect(event.defaultPrevented).toBe(true);
		expect(position()).toBe(120);
	});

	it("eases the page toward the target, a part of the way on each frame", () => {
		fakeLayout(LAYOUT);
		fakeReducedMotion(false);
		const frames = fakeFrames();
		mount();

		wheel(100);
		frames.frame(16);
		// 1 - exp(-0.016 * 8) of the way: 12.0px of 100px.
		expect(position()).toBeCloseTo(12.01, 1);
		frames.frame(16);
		expect(position()).toBeCloseTo(22.58, 1);
		for (let i = 0; i < 100; i++) frames.frame(16);
		expect(position()).toBe(100);
	});

	it("loops: up from the top shows the end of the page, and down past the end shows the start", () => {
		fakeLayout(LAYOUT);
		fakeReducedMotion(true);
		const frames = fakeFrames();
		const scroll = mount();

		wheel(-100);
		frames.frame();
		expect(position()).toBe(4900);
		expect(scroll.dir()).toBe(-1);

		wheel(300);
		frames.frame();
		expect(position()).toBe(200);
		expect(scroll.dir()).toBe(1);
		expect(scroll.len()).toBe(5000);
	});

	it("reads line and page deltas, and leaves zoom and horizontal swipes to the browser", () => {
		fakeLayout(LAYOUT);
		fakeReducedMotion(true);
		const frames = fakeFrames();
		mount();

		wheel(3, { deltaMode: 1 });
		frames.frame();
		expect(position()).toBe(48);

		wheel(1, { deltaMode: 2 });
		frames.frame();
		expect(position()).toBe(48 + innerHeight);

		const zoom = wheel(100, { ctrlKey: true });
		const sideways = wheel(10, { deltaX: 40 });
		frames.frame();
		expect(zoom.defaultPrevented).toBe(false);
		expect(sideways.defaultPrevented).toBe(false);
		expect(position()).toBe(48 + innerHeight);
	});

	it("stops when the signal aborts", () => {
		fakeLayout(LAYOUT);
		fakeReducedMotion(true);
		const frames = fakeFrames();
		mount();
		frames.frame();

		controllers[0].abort();

		expect(wheel(100).defaultPrevented).toBe(false);
		expect(frames.waiting()).toBe(0);
	});
});

function key(key: string, init: KeyboardEventInit = {}, on: EventTarget = document.body): KeyboardEvent {
	const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
	on.dispatchEvent(event);
	return event;
}

describe("the keys", () => {
	/** A page step: the view under the nav, less 48px. */
	const page = () => innerHeight - 64 - 48;

	beforeEach(() => {
		fakeLayout(LAYOUT);
		fakeReducedMotion(true);
	});

	it("move the page by 80px with the arrows, and by a page with Page Down, Page Up, Space and Shift+Space", () => {
		const frames = fakeFrames();
		mount();
		const press = (name: string, init?: KeyboardEventInit) => {
			expect(key(name, init).defaultPrevented, name).toBe(true);
			frames.frame();
			return position();
		};

		expect(press("ArrowDown")).toBe(80);
		expect(press("ArrowUp")).toBe(0);
		expect(press("ArrowUp")).toBe(4920);
		expect(press("ArrowDown")).toBe(0);
		expect(press("PageDown")).toBe(page());
		expect(press(" ")).toBe(2 * page());
		expect(press(" ", { shiftKey: true })).toBe(page());
		expect(press("PageUp")).toBe(0);
	});

	it("go to the start of the loop with Home, and to the end of one copy with End", () => {
		const frames = fakeFrames();
		mount();
		wheel(5000 + 1000);
		frames.frame();

		key("End");
		frames.frame();
		expect(position()).toBe(5000 - innerHeight);

		key("Home");
		frames.frame();
		expect(position()).toBe(0);
	});

	it("leave typing, Space on a control, shortcuts and handled keys to the browser", () => {
		const frames = fakeFrames();
		mount();
		const ignored = [
			key("ArrowDown", {}, el("#f-url")),
			key(" ", {}, el("textarea")),
			key(" ", {}, el(".nav-links a")),
			key(" ", {}, el("button")),
			key(" ", {}, el("summary")),
			key("ArrowDown", { altKey: true }),
			key("PageDown", { ctrlKey: true }),
			key("End", { metaKey: true }),
			key("a"),
		];
		const handled = new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true });
		handled.preventDefault();
		document.body.dispatchEvent(handled);
		frames.frame();

		for (const event of ignored) expect(event.defaultPrevented, event.key).toBe(false);
		expect(position()).toBe(0);
		// The arrows still move the page from a link.
		key("ArrowDown", {}, el(".nav-links a"));
		frames.frame();
		expect(position()).toBe(80);
	});
});

describe("the in-page links", () => {
	beforeEach(() => {
		fakeLayout(LAYOUT);
		fakeReducedMotion(false);
	});

	it("go down to a near section, put the section under the nav, focus it and set the hash", () => {
		const frames = fakeFrames();
		mount();
		const click = new MouseEvent("click", { bubbles: true, cancelable: true });

		el('.nav-links a[href="#packages"]').dispatchEvent(click);
		frames.frame(16);
		const first = position();
		for (let i = 0; i < 100; i++) frames.frame(16);

		expect(click.defaultPrevented).toBe(true);
		expect(first).toBeGreaterThan(0);
		expect(first).toBeLessThan(500);
		expect(position()).toBe(1000 - 64);
		expect(document.activeElement).toBe(el("#packages"));
		expect(el("#packages").tabIndex).toBe(-1);
		expect(location.hash).toBe("#packages");
	});

	it("go up through the seam when the section is nearer that way round", () => {
		const frames = fakeFrames();
		mount();

		el('.nav-links a[href="#faq"]').click();
		frames.frame(16);
		const first = position();
		for (let i = 0; i < 100; i++) frames.frame(16);

		// 4000 - 64 down is 3936px; up through the top of the loop it is 1064px.
		expect(first).toBeGreaterThan(4800);
		expect(position()).toBe(4000 - 64);
		expect(document.activeElement).toBe(el("#faq"));
	});

	it("start the page at the section of the hash, with no easing", () => {
		history.replaceState(null, "", "/#faq");
		const frames = fakeFrames();
		mount();

		frames.frame(16);

		expect(position()).toBe(4000 - 64);
	});
});

describe("the focus", () => {
	beforeEach(() => {
		fakeLayout({ ...LAYOUT, "#f-url": { top: 3000, height: 40 } });
		fakeReducedMotion(true);
	});

	const box = (top: number, height: number) =>
		({ top, bottom: top + height, height, left: 0, right: 100, width: 100, x: 0, y: top }) as DOMRect;

	it("brings a control that Tab or a form error focuses to the middle of the view, the short way round", () => {
		const frames = fakeFrames();
		mount();
		const field = el("#f-url");
		vi.spyOn(field, "getBoundingClientRect").mockReturnValue(box(2000, 40));

		field.focus();
		frames.frame();

		// The field is 40px high, so it goes to (768 - 40) / 2 = 364px from the top of the view.
		expect(innerHeight).toBe(768);
		expect(position()).toBe(3000 - 364);
	});

	it("leaves the page where it is when the focused control is in view", () => {
		const frames = fakeFrames();
		mount();
		const field = el("#f-url");
		vi.spyOn(field, "getBoundingClientRect").mockReturnValue(box(300, 40));

		field.focus();
		frames.frame();

		expect(position()).toBe(0);
	});
});

describe("the sticky blocks", () => {
	it("follow the view inside their parent, as position: sticky does in a page that scrolls", () => {
		const style = document.createElement("style");
		style.textContent = ".fs-stage { position: sticky; top: 64px }";
		document.head.append(style);
		try {
			fakeLayout({ ...LAYOUT, "#services": { top: 200, height: 2000 }, ".fs-stage": { top: 200, height: 600 } });
			fakeReducedMotion(true);
			const frames = fakeFrames();
			mount();
			const [stage, twinStage] = document.querySelectorAll<HTMLElement>(".fs-stage");
			let shown = 0;
			const at = (y: number) => {
				wheel(y - shown);
				shown = y;
				frames.frame();
				return stage.style.transform;
			};

			expect(at(0)).toBe("translateY(0px)");
			expect(at(500)).toBe("translateY(364px)");
			// The stage stops at the end of its parent: 200 + 2000 - 200 - 600.
			expect(at(2000)).toBe("translateY(1400px)");
			expect(twinStage.style.transform).toBe("");
			expect(el(".sticky-est").style.transform).toBe("");
		} finally {
			style.remove();
		}
	});
});

function touch(type: string, x: number, y: number, time: number): void {
	const event = new Event(type, { bubbles: true });
	Object.defineProperty(event, "touches", { value: type === "touchend" ? [] : [{ clientX: x, clientY: y }] });
	Object.defineProperty(event, "timeStamp", { value: time });
	el(".vs").dispatchEvent(event);
}

describe("touch", () => {
	beforeEach(() => {
		fakeLayout(LAYOUT);
		fakeReducedMotion(false);
	});

	it("drags the page with the finger, then lets it run on with the speed of the swipe", () => {
		const frames = fakeFrames();
		mount();

		touch("touchstart", 200, 500, 0);
		touch("touchmove", 200, 497, 8);
		frames.frame();
		expect(position()).toBe(0);

		touch("touchmove", 200, 400, 16);
		touch("touchmove", 200, 300, 32);
		frames.frame();
		expect(position()).toBe(200);

		touch("touchend", 200, 300, 40);
		for (let i = 0; i < 200; i++) frames.frame();
		// The last speed is 0.8 * 100 / 16 + 0.2 * (0.8 * 100 / 16) = 6px a millisecond, and it runs on 300 times that.
		expect(position()).toBe(200 + 1800);
	});

	it("leaves a horizontal swipe to the browser", () => {
		const frames = fakeFrames();
		mount();

		touch("touchstart", 300, 500, 0);
		touch("touchmove", 200, 490, 16);
		touch("touchmove", 100, 400, 32);
		touch("touchend", 100, 400, 40);
		for (let i = 0; i < 50; i++) frames.frame();

		expect(position()).toBe(0);
	});
});
