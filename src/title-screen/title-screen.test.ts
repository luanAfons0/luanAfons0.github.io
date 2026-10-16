// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTitleScreen, type TitleScreen, type TitleScreenOptions } from "./title-screen";

const BASE = "/portfolio/";

/** The real index.html, with the base path Vite puts in. */
const PAGE = readFileSync(resolve(import.meta.dirname, "../../index.html"), "utf8").replaceAll("%BASE_URL%", BASE);
/** The page body without its script: the Title Screen markup and the game canvas. */
const BODY = PAGE.slice(PAGE.indexOf("<body>") + "<body>".length, PAGE.indexOf("</body>")).replace(
	/<script[\s\S]*?<\/script>/g,
	"",
);

let screens: TitleScreen[] = [];

beforeEach(() => {
	document.body.innerHTML = BODY;
});

afterEach(() => {
	for (const screen of screens) screen.dispose();
	screens = [];
});

const newGame = () => item("new-game");
const skip = () => item("skip");

function item(name: string): HTMLElement {
	const element = document.querySelector<HTMLElement>(`[data-menu-item="${name}"]`);
	if (!element) throw new Error(`index.html has no ${name} menu item.`);
	return element;
}

/** A loadGame() whose promise the test settles by hand. */
function deferredLoad<T = string>() {
	let resolve!: (value: T) => void;
	let reject!: (error: unknown) => void;
	const load = vi.fn(
		() =>
			new Promise<T>((res, rej) => {
				resolve = res;
				reject = rej;
			}),
	);
	return { load, resolve: (value: T) => resolve(value), reject: (error: unknown) => reject(error) };
}

function setUp(overrides: Partial<TitleScreenOptions<string>> = {}) {
	const loader = deferredLoad();
	const options = {
		root: document,
		loadGame: loader.load,
		startGame: vi.fn(),
		onNewGame: vi.fn(),
		navigate: vi.fn(),
		reload: vi.fn(),
		...overrides,
	};
	const screen = createTitleScreen(options);
	screens.push(screen);
	return { ...loader, ...options, screen };
}

describe("Title Screen loading", () => {
	it("loads no game code until the visitor points at NEW GAME, then loads it once", () => {
		const { load } = setUp();
		expect(load).not.toHaveBeenCalled();

		newGame().dispatchEvent(new Event("pointerenter"));
		newGame().dispatchEvent(new Event("pointerenter"));

		expect(load).toHaveBeenCalledTimes(1);
	});

	it("starts loading the game when NEW GAME gets the keyboard focus", () => {
		const { load } = setUp();

		newGame().focus();

		expect(load).toHaveBeenCalledTimes(1);
	});
});

function press(code: string): KeyboardEvent {
	const event = new KeyboardEvent("keydown", { code, key: code, bubbles: true, cancelable: true });
	(document.activeElement ?? document.body).dispatchEvent(event);
	return event;
}

describe("Title Screen keyboard", () => {
	it("moves the selection and the focus with the arrow keys, and wraps at both ends", () => {
		setUp();
		expect(newGame().classList.contains("is-selected")).toBe(true);

		press("ArrowDown");
		expect(document.activeElement).toBe(skip());
		expect(skip().classList.contains("is-selected")).toBe(true);
		expect(newGame().classList.contains("is-selected")).toBe(false);

		press("ArrowDown");
		expect(document.activeElement).toBe(newGame());

		press("ArrowUp");
		expect(document.activeElement).toBe(skip());

		press("ArrowUp");
		expect(document.activeElement).toBe(newGame());
		expect(newGame().classList.contains("is-selected")).toBe(true);
	});

	it("keeps the arrow keys from scrolling the page", () => {
		setUp();

		expect(press("ArrowDown").defaultPrevented).toBe(true);
	});

	it("opens the Skip View when the visitor presses Enter on SKIP", () => {
		const { navigate, load } = setUp();

		press("ArrowDown");
		press("Enter");

		expect(navigate).toHaveBeenCalledWith(new URL(`${BASE}skip/`, location.href).href);
		expect(load).not.toHaveBeenCalled();
	});
});

/** Lets the pending promise callbacks run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const titleScreen = () => document.querySelector<HTMLElement>("[data-title-screen]");
const loadingBar = () => document.querySelector<HTMLElement>("[data-loading-bar]");
const loadError = () => document.querySelector<HTMLElement>("[data-load-error]");

describe("NEW GAME", () => {
	it("shows a loading bar when the visitor clicks before the game is ready, then starts the game", async () => {
		const { resolve, startGame, onNewGame } = setUp();

		newGame().click();

		expect(onNewGame).toHaveBeenCalledTimes(1);
		expect(loadingBar()?.hidden).toBe(false);
		expect(startGame).not.toHaveBeenCalled();

		resolve("the game");
		await settle();

		expect(startGame).toHaveBeenCalledWith("the game");
		expect(titleScreen()?.hidden).toBe(true);
		expect(loadingBar()?.hidden).toBe(true);
	});

	it("starts at once with no loading bar when the game loaded on hover", async () => {
		const { resolve, startGame } = setUp();
		newGame().dispatchEvent(new Event("pointerenter"));
		resolve("the game");
		await settle();

		newGame().click();
		await settle();

		expect(startGame).toHaveBeenCalledWith("the game");
		expect(loadingBar()?.hidden).toBe(true);
	});

	it("starts the game when the visitor presses Enter on the first screen, with nothing focused", async () => {
		const { load, resolve, startGame, onNewGame } = setUp();

		press("Enter");
		expect(onNewGame).toHaveBeenCalledTimes(1);
		expect(load).toHaveBeenCalledTimes(1);

		resolve("the game");
		await settle();
		expect(startGame).toHaveBeenCalledWith("the game");
	});

	it("starts the game only once when the visitor clicks again while it loads", async () => {
		const { resolve, startGame, onNewGame } = setUp();

		newGame().click();
		newGame().click();
		resolve("the game");
		await settle();

		expect(onNewGame).toHaveBeenCalledTimes(1);
		expect(startGame).toHaveBeenCalledTimes(1);
	});

	it("gives the arrow keys and Enter back to the game after it starts", async () => {
		const { resolve, navigate } = setUp();
		newGame().click();
		resolve("the game");
		await settle();

		expect(press("ArrowDown").defaultPrevented).toBe(false);
		expect(press("Enter").defaultPrevented).toBe(false);
		expect(navigate).not.toHaveBeenCalled();
	});

	it("shows an error when the game does not load, and reloads the page when the visitor tries again", async () => {
		// A browser keeps a failed module import failed, so only a new page can load the game again.
		const { load, reject, startGame, reload } = setUp();

		newGame().click();
		reject(new Error("offline"));
		await settle();

		expect(startGame).not.toHaveBeenCalled();
		expect(loadingBar()?.hidden).toBe(true);
		expect(loadError()?.hidden).toBe(false);
		expect(loadError()?.textContent).toMatch(/could not load/i);
		expect(titleScreen()?.hidden).toBe(false);

		newGame().click();
		expect(reload).toHaveBeenCalledTimes(1);
		expect(load).toHaveBeenCalledTimes(1);
	});

	it("shows a failed load from a hover only when the visitor chooses NEW GAME", async () => {
		const { reject, reload } = setUp();
		newGame().dispatchEvent(new Event("pointerenter"));
		reject(new Error("offline"));
		await settle();
		expect(loadError()?.hidden).toBe(true);

		newGame().click();
		await settle();

		expect(loadError()?.hidden).toBe(false);
		expect(reload).not.toHaveBeenCalled();
	});
});
