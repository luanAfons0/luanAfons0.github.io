// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Face } from "../engine/raycast";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "../game/settings";
import { titleScreenPage } from "./page";
import { createTitleScreen, type TitleScreen, type TitleScreenOptions } from "./title-screen";

const BASE = "/portfolio/";

/** The real index.html, as Vite builds it: the base path and the Level counts put in. */
const PAGE = titleScreenPage(
	readFileSync(resolve(import.meta.dirname, "../../index.html"), "utf8").replaceAll("%BASE_URL%", BASE),
);
/** The page body without its script: the Title Screen markup and the game canvas. */
const BODY = PAGE.slice(PAGE.indexOf("<body>") + "<body>".length, PAGE.indexOf("</body>")).replace(
	/<script[\s\S]*?<\/script>/g,
	"",
);

let screens: TitleScreen[] = [];

beforeEach(() => {
	document.body.innerHTML = BODY;
	document.documentElement.removeAttribute("data-theme");
	localStorage.clear();
	systemScheme("light");
	motion("reduce");
});

afterEach(() => {
	for (const screen of screens) screen.dispose();
	screens = [];
	vi.restoreAllMocks();
});

/** Sets the system light or dark setting that `prefers-color-scheme` reports. */
function systemScheme(scheme: "light" | "dark") {
	(window as unknown as HappyDomWindow).happyDOM.settings.device.prefersColorScheme = scheme;
}

/** Sets the reduced-motion setting. The tests run with "reduce" (no dive) unless a test asks for the dive. */
function motion(preference: "reduce" | "no-preference") {
	(window as unknown as HappyDomWindow).happyDOM.settings.device.prefersReducedMotion = preference;
}

interface HappyDomWindow {
	happyDOM: { settings: { device: { prefersColorScheme: string; prefersReducedMotion: string } } };
}

const newGame = () => item("new-game");
const skip = () => item("skip");
const themeItem = () => item("theme");

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
	it("moves the selection and the focus across all three items with the arrow keys, and wraps at both ends", () => {
		setUp();
		expect(newGame().classList.contains("is-selected")).toBe(true);

		press("ArrowDown");
		expect(document.activeElement).toBe(skip());
		expect(skip().classList.contains("is-selected")).toBe(true);
		expect(newGame().classList.contains("is-selected")).toBe(false);

		press("ArrowDown");
		expect(document.activeElement).toBe(themeItem());
		expect(themeItem().classList.contains("is-selected")).toBe(true);

		press("ArrowDown");
		expect(document.activeElement).toBe(newGame());

		press("ArrowUp");
		expect(document.activeElement).toBe(themeItem());

		press("ArrowUp");
		expect(document.activeElement).toBe(skip());

		press("ArrowUp");
		expect(document.activeElement).toBe(newGame());
		expect(newGame().classList.contains("is-selected")).toBe(true);
	});

	it("selects the item the visitor points at or focuses", () => {
		setUp();

		themeItem().dispatchEvent(new Event("pointerenter"));
		expect(themeItem().classList.contains("is-selected")).toBe(true);
		expect(newGame().classList.contains("is-selected")).toBe(false);

		skip().focus();
		expect(skip().classList.contains("is-selected")).toBe(true);
		expect(themeItem().classList.contains("is-selected")).toBe(false);
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

	it.each([
		["after it loads", false],
		["at once, when it loaded on hover", true],
	])(
		"shows the Title Screen again with the error when the game fails to start %s, and SKIP still works",
		async (_, onHover) => {
			const startGame = vi.fn(() => {
				throw new Error("No canvas.");
			});
			const { resolve, navigate, reload } = setUp({ startGame });
			vi.spyOn(console, "error").mockImplementation(() => {});
			if (onHover) newGame().dispatchEvent(new Event("pointerenter"));
			if (onHover) resolve("the game");
			await settle();

			newGame().click();
			resolve("the game");
			await settle();

			expect(startGame).toHaveBeenCalledTimes(1);
			expect(titleScreen()?.hidden).toBe(false);
			expect(loadingBar()?.hidden).toBe(true);
			expect(loadError()?.hidden).toBe(false);
			expect(loadError()?.textContent).toMatch(/could not load/i);

			press("ArrowDown");
			press("Enter");
			expect(navigate).toHaveBeenCalledTimes(1);
			newGame().click();
			expect(reload).toHaveBeenCalledTimes(1);
		},
	);

	it("starts the game even when the NEW GAME hook throws (for example, no sound)", async () => {
		const onNewGame = vi.fn(() => {
			throw new Error("No Web Audio.");
		});
		const { resolve, startGame } = setUp({ onNewGame });
		vi.spyOn(console, "error").mockImplementation(() => {});

		newGame().click();
		resolve("the game");
		await settle();

		expect(startGame).toHaveBeenCalledWith("the game");
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

describe("Title Screen analytics", () => {
	it("sends new-game on NEW GAME", () => {
		const track = vi.fn();
		setUp({ track });
		newGame().click();
		expect(track).toHaveBeenCalledExactlyOnceWith("new-game");
	});

	it("sends skip when the visitor chooses SKIP with Enter", () => {
		const track = vi.fn();
		const { navigate } = setUp({ track });
		document.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowDown" }));
		document.dispatchEvent(new KeyboardEvent("keydown", { code: "Enter" }));
		expect(track).toHaveBeenCalledExactlyOnceWith("skip");
		expect(navigate).toHaveBeenCalled();
	});
});

describe("Title Screen analytics on a SKIP click", () => {
	it("sends skip when the visitor clicks SKIP", () => {
		const track = vi.fn();
		setUp({ track });
		skip().addEventListener("click", (event) => event.preventDefault());
		skip().click();
		expect(track).toHaveBeenCalledExactlyOnceWith("skip");
	});
});

/** The inline script in the page head (the phone redirect and the saved Theme), run on a desktop. */
function runHeadScript() {
	const head = PAGE.slice(0, PAGE.indexOf("</head>"));
	const script = /<script>([\s\S]*?)<\/script>/.exec(head)?.[1];
	if (!script) throw new Error("index.html has no inline script in its head.");
	const desktop = (query: string) => ({ matches: query === "(pointer: fine)" || query === "(any-pointer: fine)" });
	new Function("matchMedia", "location", script)(desktop, { replace: vi.fn() });
}

const shownTheme = () => document.documentElement.getAttribute("data-theme");
const themeLabel = () => themeItem().textContent?.replace(/\s+/g, " ").trim();

describe("Theme", () => {
	it.each([
		["light", "Paper"],
		["dark", "Board"],
	] as const)("follows a %s system setting when no Theme is saved: the Theme item shows %s", (scheme, label) => {
		systemScheme(scheme);
		runHeadScript();
		setUp();

		expect(shownTheme()).toBeNull();
		expect(themeLabel()).toBe(`Theme: ${label}`);
	});

	it("applies a saved Theme in the head script, before the first paint", () => {
		saveSettings({ ...DEFAULT_SETTINGS, theme: "board" });

		runHeadScript();
		expect(shownTheme()).toBe("board");

		setUp();
		expect(themeLabel()).toBe("Theme: Board");
	});

	it("falls back to the system setting when storage is broken", () => {
		systemScheme("dark");
		vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
			throw new Error("Blocked site data.");
		});

		runHeadScript();
		setUp();

		expect(shownTheme()).toBeNull();
		expect(themeLabel()).toBe("Theme: Board");
	});

	it("ignores a saved Theme that is not a Theme", () => {
		localStorage.setItem("portfolio.settings.v1", JSON.stringify({ ...DEFAULT_SETTINGS, theme: "neon" }));

		runHeadScript();
		setUp();

		expect(shownTheme()).toBeNull();
		expect(loadSettings().theme).toBeUndefined();
		expect(themeLabel()).toBe("Theme: Paper");
	});

	it("switches the look when the visitor chooses the Theme item, saves it, keeps the item selected, and sends theme/<id>", () => {
		saveSettings({ ...DEFAULT_SETTINGS, sound: false });
		const track = vi.fn();
		setUp({ track });

		press("ArrowUp");
		press("Enter");

		expect(shownTheme()).toBe("board");
		expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, sound: false, theme: "board" });
		expect(themeLabel()).toBe("Theme: Board");
		expect(themeItem().classList.contains("is-selected")).toBe(true);
		expect(document.activeElement).toBe(themeItem());
		expect(track).toHaveBeenCalledExactlyOnceWith("theme/board");

		themeItem().click();

		expect(shownTheme()).toBe("paper");
		expect(loadSettings().theme).toBe("paper");
		expect(themeLabel()).toBe("Theme: Paper");
		expect(track).toHaveBeenLastCalledWith("theme/paper");
	});

	it("switches away from the system look on the first choice", () => {
		systemScheme("dark");
		const { load, navigate } = setUp();

		themeItem().click();

		expect(shownTheme()).toBe("paper");
		expect(load).not.toHaveBeenCalled();
		expect(navigate).not.toHaveBeenCalled();
	});

	it("still switches the look when storage is broken", () => {
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw new Error("Storage is full.");
		});
		setUp();

		themeItem().click();

		expect(shownTheme()).toBe("board");
		expect(themeLabel()).toBe("Theme: Board");
	});
});

describe("Title Screen Features", () => {
	const room = { name: "Lobby", x: 0, y: 0, width: 4, height: 4 };

	it("counts the Rooms, Exhibits, and Bugs of the Level", () => {
		const level = {
			rooms: [room],
			exhibits: [
				{ id: "a", x: 0, y: 1, face: Face.West },
				{ id: "b", x: 0, y: 2, face: Face.West },
			],
			bugSpawns: [{ x: 1, y: 1, room }],
		};

		const page = titleScreenPage("<li><!--level-features--></li>", level);

		expect(page).toBe("<li>1 Room, 2 Exhibits, 1 Bug to fix</li>");
	});

	it("fills the real page from the real Level", () => {
		expect(PAGE).not.toContain("level-features");
		expect(document.querySelector("[data-title-screen]")?.textContent).toMatch(
			/\d+ Rooms?, \d+ Exhibits?, \d+ Bugs? to fix/,
		);
	});
});

describe("Title Screen page", () => {
	it("has the page title and no em dash in its copy", () => {
		expect(PAGE).toContain("<title>Luan Afonso, portfolio</title>");
		expect(PAGE).not.toContain("\u2014");
		expect(PAGE).not.toContain("&mdash;");
	});
});

describe("NEW GAME dive", () => {
	const dive = () => document.querySelector<HTMLElement>("[data-dive]");
	const rect = (top: number, left: number, width: number, height: number) =>
		({ top, left, width, height, right: left + width, bottom: top + height }) as DOMRect;
	const flush = () => vi.advanceTimersByTimeAsync(0);

	beforeEach(() => {
		motion("no-preference");
		vi.useFakeTimers();
		vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(1000);
		vi.spyOn(document.documentElement, "clientHeight", "get").mockReturnValue(600);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	async function click() {
		const setup = setUp();
		newGame().dispatchEvent(new Event("pointerenter"));
		setup.resolve("the game");
		await flush();
		newGame().click();
		await flush();
		return setup;
	}

	it("grows from the chip in Paper and starts the game when the transition ends", async () => {
		document.documentElement.dataset.theme = "paper";
		const chip = document.querySelector<HTMLElement>("[data-chip]");
		vi.spyOn(chip as HTMLElement, "getBoundingClientRect").mockReturnValue(rect(100, 300, 200, 150));
		const { startGame, onNewGame } = await click();

		expect(onNewGame).toHaveBeenCalledTimes(1);
		expect(startGame).not.toHaveBeenCalled();
		expect(dive()?.hidden).toBe(false);
		const style = (name: string) => dive()?.style.getPropertyValue(name);
		expect([style("--dive-top"), style("--dive-right"), style("--dive-bottom"), style("--dive-left")]).toEqual([
			"100px",
			"500px",
			"350px",
			"300px",
		]);

		dive()?.dispatchEvent(new Event("transitionend"));
		await flush();
		expect(startGame).toHaveBeenCalledWith("the game");
		expect(titleScreen()?.hidden).toBe(true);
		expect(dive()?.hidden).toBe(true);
	});

	it("grows from the selected pad in Board", async () => {
		document.documentElement.dataset.theme = "board";
		const pad = newGame().querySelector<HTMLElement>(".title-screen__pad");
		vi.spyOn(pad as HTMLElement, "getBoundingClientRect").mockReturnValue(rect(40, 60, 20, 10));
		await click();

		expect(dive()?.style.getPropertyValue("--dive-top")).toBe("40px");
		expect(dive()?.style.getPropertyValue("--dive-left")).toBe("60px");
	});

	it("starts the game after the fallback timeout when transitionend never fires", async () => {
		const { startGame } = await click();

		await vi.advanceTimersByTimeAsync(100);
		expect(startGame).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1000);
		expect(startGame).toHaveBeenCalledTimes(1);
	});

	it("starts the game once when both the transition end and the timeout fire", async () => {
		const { startGame } = await click();
		dive()?.dispatchEvent(new Event("transitionend"));
		await vi.advanceTimersByTimeAsync(2000);
		expect(startGame).toHaveBeenCalledTimes(1);
	});

	it("waits for the game to load after the dive, with the loading bar shown", async () => {
		const { resolve, startGame } = setUp();
		newGame().click();
		await vi.advanceTimersByTimeAsync(2000);

		expect(startGame).not.toHaveBeenCalled();
		expect(loadingBar()?.hidden).toBe(false);
		expect(dive()?.hidden).toBe(true);

		resolve("the game");
		await flush();
		expect(startGame).toHaveBeenCalledWith("the game");
	});

	it("shows no dive and starts at once under reduced motion", async () => {
		motion("reduce");
		const setup = setUp();
		newGame().dispatchEvent(new Event("pointerenter"));
		setup.resolve("the game");
		await flush();

		newGame().click();

		expect(setup.startGame).toHaveBeenCalledWith("the game");
		expect(dive()?.hidden).toBe(true);
	});

	it("still sends the new-game event inside the gesture", async () => {
		const track = vi.fn();
		setUp({ track });
		newGame().click();
		expect(track).toHaveBeenCalledWith("new-game");
	});

	it("hides the dive and shows the load error when the game fails to load", async () => {
		const { reject } = setUp();
		vi.spyOn(console, "error").mockImplementation(() => {});
		newGame().click();
		reject(new Error("offline"));
		await flush();

		expect(dive()?.hidden).toBe(true);
		expect(loadError()?.hidden).toBe(false);
	});
});
