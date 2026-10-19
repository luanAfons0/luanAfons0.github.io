// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Face } from "../engine/raycast";
import { loadLevel } from "../game/level";
import sampleLevel from "../game/levels/sample.json";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "../game/settings";
import { THEMES } from "../game/theme";
import { skipViewPage } from "../skip-view/page";
import { withThemeScript } from "../theme-script";
import { titleScreenPage } from "./page";
import { createTitleScreen, type TitleScreen, type TitleScreenOptions } from "./title-screen";

const BASE = "/portfolio/";

/** The real index.html, as Vite builds it: the base path, the Level counts, and the Theme head script put in. */
const PAGE = withThemeScript(
	titleScreenPage(
		readFileSync(resolve(import.meta.dirname, "../../index.html"), "utf8").replaceAll("%BASE_URL%", BASE),
	),
);
/** The data-theme on the root of the real page, as its HTML carries it before any script runs. */
const PAGE_THEME = new DOMParser().parseFromString(PAGE, "text/html").documentElement.getAttribute("data-theme");
/** The page body without its script: the Title Screen markup and the game canvas. */
const BODY = PAGE.slice(PAGE.indexOf("<body>") + "<body>".length, PAGE.indexOf("</body>")).replace(
	/<script[\s\S]*?<\/script>/g,
	"",
);

let screens: TitleScreen[] = [];

beforeEach(() => {
	document.body.innerHTML = BODY;
	// The root as the page loads it: the default Theme from the HTML, before the head scripts run.
	if (PAGE_THEME === null) document.documentElement.removeAttribute("data-theme");
	else document.documentElement.setAttribute("data-theme", PAGE_THEME);
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
const themeItem = () => item<HTMLSelectElement>("theme");

function item<T extends HTMLElement = HTMLElement>(name: string): T {
	const element = document.querySelector<T>(`[data-menu-item="${name}"]`);
	if (!element) throw new Error(`index.html has no ${name} menu item.`);
	return element;
}

/** The box that shows a menu item: the item itself, or the row around the Theme select. */
function box(element: HTMLElement): HTMLElement {
	return element.closest<HTMLElement>(".title-screen__item") ?? element;
}

/** Whether a menu item shows the selection marker. */
const isSelected = (element: HTMLElement) => box(element).classList.contains("is-selected");

/** Moves the mouse onto a menu item: the pointer enters its box. */
const pointAt = (element: HTMLElement) => box(element).dispatchEvent(new Event("pointerenter"));

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

		pointAt(newGame());
		pointAt(newGame());

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
		expect(isSelected(newGame())).toBe(true);

		press("ArrowDown");
		expect(document.activeElement).toBe(skip());
		expect(isSelected(skip())).toBe(true);
		expect(isSelected(newGame())).toBe(false);

		press("ArrowDown");
		expect(document.activeElement).toBe(themeItem());
		expect(isSelected(themeItem())).toBe(true);

		press("ArrowDown");
		expect(document.activeElement).toBe(newGame());

		press("ArrowUp");
		expect(document.activeElement).toBe(themeItem());

		press("ArrowUp");
		expect(document.activeElement).toBe(skip());

		press("ArrowUp");
		expect(document.activeElement).toBe(newGame());
		expect(isSelected(newGame())).toBe(true);
	});

	it("selects the item the visitor points at or focuses", () => {
		setUp();

		pointAt(themeItem());
		expect(isSelected(themeItem())).toBe(true);
		expect(isSelected(newGame())).toBe(false);

		skip().focus();
		expect(isSelected(skip())).toBe(true);
		expect(isSelected(themeItem())).toBe(false);
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
		pointAt(newGame());
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
			if (onHover) pointAt(newGame());
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
		pointAt(newGame());
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

/** The inline scripts in the head of a page, in page order. */
function headScripts(page: string): string[] {
	const head = page.slice(0, page.indexOf("</head>"));
	return [...head.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1] ?? "");
}

/** The inline scripts in the page head (the phone redirect, then the Theme head script), run on a desktop. */
function runHeadScript() {
	const scripts = headScripts(PAGE);
	if (scripts.length === 0) throw new Error("index.html has no inline script in its head.");
	const desktop = (query: string) => ({ matches: query === "(pointer: fine)" || query === "(any-pointer: fine)" });
	for (const script of scripts) new Function("matchMedia", "location", script)(desktop, { replace: vi.fn() });
}

const shownTheme = () => document.documentElement.getAttribute("data-theme");

/** The text of the label of the Theme select that a screen reader reads (its colon is hidden). */
const themeLabel = () => {
	const label = themeItem().closest("label")?.cloneNode(true) as HTMLElement | undefined;
	for (const hidden of label?.querySelectorAll('select, [aria-hidden="true"]') ?? []) hidden.remove();
	return label?.textContent?.replace(/\s+/g, " ").trim();
};

/** Chooses a Theme in the Theme select, as the native picker does: a new value, then a change event. */
function chooseTheme(theme: string) {
	themeItem().value = theme;
	themeItem().dispatchEvent(new Event("change", { bubbles: true }));
}

/** Gives the Theme select a showPicker() (happy-dom has none), which the test watches. */
function stubPicker(open: () => void = () => {}) {
	const showPicker = vi.fn(open);
	Object.defineProperty(themeItem(), "showPicker", { value: showPicker, configurable: true });
	return showPicker;
}

describe("Theme", () => {
	it("shows Dungeon with JavaScript off: the page root carries the default Theme in its HTML", () => {
		expect(PAGE_THEME).toBe("dungeon");
	});

	it.each(["light", "dark"] as const)("shows Dungeon when no Theme is saved, also on a %s system", (scheme) => {
		systemScheme(scheme);
		runHeadScript();
		setUp();

		expect(shownTheme()).toBe("dungeon");
		expect(themeItem().value).toBe("dungeon");
	});

	it("is a native select labelled Theme", () => {
		setUp();

		expect(themeItem().tagName).toBe("SELECT");
		expect(themeLabel()).toBe("Theme");
	});

	it("applies a saved Theme in the head script, before the first paint", () => {
		saveSettings({ ...DEFAULT_SETTINGS, theme: "board" });

		runHeadScript();
		expect(shownTheme()).toBe("board");

		setUp();
		expect(themeItem().value).toBe("board");
	});

	it.each(THEMES)("accepts the saved %s Theme in the head script", (theme) => {
		saveSettings({ ...DEFAULT_SETTINGS, theme });
		runHeadScript();
		expect(shownTheme()).toBe(theme);
	});

	it("has the same Theme head script as the Skip View, after the phone redirect", () => {
		const [redirect, themeScript, ...rest] = headScripts(PAGE);
		expect(redirect).toContain("location.replace");
		expect(themeScript).not.toContain("location");
		expect(rest).toEqual([]);
		expect(headScripts(withThemeScript(skipViewPage(BASE)))).toEqual([themeScript]);
	});

	it("shows Dungeon when storage is broken", () => {
		vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
			throw new Error("Blocked site data.");
		});

		runHeadScript();
		setUp();

		expect(shownTheme()).toBe("dungeon");
		expect(themeItem().value).toBe("dungeon");
	});

	it("ignores a saved Theme that is not a Theme", () => {
		localStorage.setItem("portfolio.settings.v1", JSON.stringify({ ...DEFAULT_SETTINGS, theme: "neon" }));

		runHeadScript();
		setUp();

		expect(shownTheme()).toBe("dungeon");
		expect(loadSettings().theme).toBeUndefined();
		expect(themeItem().value).toBe("dungeon");
	});

	it("switches the look when the visitor chooses a Theme, saves it, keeps the item selected, and sends theme/<id>", () => {
		saveSettings({ ...DEFAULT_SETTINGS, sound: false });
		const track = vi.fn();
		setUp({ track });
		press("ArrowUp");

		chooseTheme("board");

		expect(shownTheme()).toBe("board");
		expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, sound: false, theme: "board" });
		expect(themeItem().value).toBe("board");
		expect(isSelected(themeItem())).toBe(true);
		expect(document.activeElement).toBe(themeItem());
		expect(track).toHaveBeenCalledExactlyOnceWith("theme/board");

		chooseTheme("dungeon");

		expect(shownTheme()).toBe("dungeon");
		expect(loadSettings().theme).toBe("dungeon");
		expect(track).toHaveBeenLastCalledWith("theme/dungeon");

		chooseTheme("paper");

		expect(shownTheme()).toBe("paper");
		expect(loadSettings().theme).toBe("paper");
		expect(track).toHaveBeenLastCalledWith("theme/paper");
	});

	it.each(["Enter", "Space"])("opens the Theme picker on %s, and leaves the Theme as it is", (key) => {
		const track = vi.fn();
		setUp({ track });
		const showPicker = stubPicker();
		press("ArrowUp");

		const event = press(key);

		expect(showPicker).toHaveBeenCalledTimes(1);
		expect(event.defaultPrevented).toBe(true);
		expect(shownTheme()).toBe("dungeon");
		expect(themeItem().value).toBe("dungeon");
		expect(track).not.toHaveBeenCalled();
	});

	it("lets the browser open the picker its own way when showPicker() fails", () => {
		setUp();
		stubPicker(() => {
			throw new DOMException("No user activation.", "NotAllowedError");
		});
		press("ArrowUp");

		expect(press("Enter").defaultPrevented).toBe(false);
		expect(press("Space").defaultPrevented).toBe(false);
	});

	it("moves the menu selection, not the Theme, with the arrow keys on the Theme select", () => {
		setUp();
		press("ArrowUp");
		expect(document.activeElement).toBe(themeItem());

		const down = press("ArrowDown");

		expect(down.defaultPrevented).toBe(true);
		expect(document.activeElement).toBe(newGame());
		expect(themeItem().value).toBe("dungeon");
	});

	it("opens the Theme picker on Enter when the mouse selected the Theme item", () => {
		setUp();
		const showPicker = stubPicker();

		pointAt(themeItem());
		press("Enter");

		expect(document.activeElement).toBe(themeItem());
		expect(showPicker).toHaveBeenCalledTimes(1);
	});

	it("opens the Theme picker on a click on the Theme label; a click on the select itself opens it natively", () => {
		setUp();
		const showPicker = stubPicker();

		themeItem().closest("label")?.querySelector("span")?.click();
		expect(document.activeElement).toBe(themeItem());
		expect(showPicker).toHaveBeenCalledTimes(1);

		themeItem().click();
		expect(showPicker).toHaveBeenCalledTimes(1);
	});

	it("moves the focus to the option under the pointer in the open picker, so one row is active", () => {
		setUp();
		const board = themeItem().querySelector<HTMLOptionElement>('option[value="board"]');
		const dungeon = themeItem().querySelector<HTMLOptionElement>('option[value="dungeon"]');

		board?.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerType: "mouse" }));
		expect(document.activeElement).toBe(board);

		dungeon?.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerType: "touch" }));
		expect(document.activeElement).toBe(board);
	});

	it("shows a saved Dungeon Theme on the Theme select", () => {
		saveSettings({ ...DEFAULT_SETTINGS, theme: "dungeon" });
		runHeadScript();
		setUp();

		expect(loadSettings().theme).toBe("dungeon");
		expect(shownTheme()).toBe("dungeon");
		expect(themeItem().value).toBe("dungeon");
	});

	it("loads the game again after a Theme change, so the game gets the art of the new Theme", async () => {
		const loads: ((game: string) => void)[] = [];
		const load = vi.fn(() => new Promise<string>((resolve) => loads.push(resolve)));
		const { startGame } = setUp({ loadGame: load });
		pointAt(newGame());

		chooseTheme("board");
		chooseTheme("dungeon");
		loads[0]?.("paper game");
		await Promise.resolve();
		newGame().click();
		loads[1]?.("dungeon game");
		await vi.waitFor(() => expect(startGame).toHaveBeenCalled());

		expect(load).toHaveBeenCalledTimes(2);
		expect(startGame).toHaveBeenCalledExactlyOnceWith("dungeon game");
	});

	it("keeps the Theme while NEW GAME starts the game, so the game starts with the art it loaded", async () => {
		const track = vi.fn();
		const loads: (() => void)[] = [];
		// Like the real entry: the load gets the art of the shown Theme, and the start uses the shown Theme.
		const load = vi.fn(() => {
			const theme = shownTheme();
			return new Promise<string>((resolve) => loads.push(() => resolve(`${theme} game`)));
		});
		const started: string[] = [];
		setUp({ loadGame: load, track, startGame: (game) => started.push(`${game}, shown ${shownTheme()}`) });
		const showPicker = stubPicker();

		newGame().click();
		expect(themeItem().disabled).toBe(true);
		chooseTheme("board");
		pointAt(themeItem());
		press("Enter");
		loads[0]?.();
		await vi.waitFor(() => expect(started).toHaveLength(1));

		expect(started).toEqual(["dungeon game, shown dungeon"]);
		expect(load).toHaveBeenCalledTimes(1);
		expect(showPicker).not.toHaveBeenCalled();
		expect(loadSettings().theme).toBeUndefined();
		expect(themeItem().value).toBe("dungeon");
		expect(track).not.toHaveBeenCalledWith(expect.stringMatching(/^theme\//));
	});

	it("lets the visitor switch the Theme again after the game failed to load", async () => {
		const { reject } = setUp();
		vi.spyOn(console, "error").mockImplementation(() => {});
		newGame().click();
		reject(new Error("offline"));
		await vi.waitFor(() => expect(loadError()?.hidden).toBe(false));

		chooseTheme("board");

		expect(themeItem().disabled).toBe(false);
		expect(shownTheme()).toBe("board");
	});

	it("switches away from the default Theme on the first choice", () => {
		const { load, navigate } = setUp();

		chooseTheme("paper");

		expect(shownTheme()).toBe("paper");
		expect(load).not.toHaveBeenCalled();
		expect(navigate).not.toHaveBeenCalled();
	});

	it("still switches the look when storage is broken", () => {
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw new Error("Storage is full.");
		});
		setUp();

		chooseTheme("board");

		expect(shownTheme()).toBe("board");
		expect(themeItem().value).toBe("board");
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

		const page = titleScreenPage(
			"<li><!--level-features--></li><dd><!--level-rooms--></dd><dd><!--level-exhibits--></dd><dd><!--level-bugs--></dd><select><!--theme-options--></select><!--default-theme-->",
			level,
		);

		expect(page).toMatch(/^<li>1 Room, 2 Exhibits, 1 Bug to fix<\/li><dd>1<\/dd><dd>2<\/dd><dd>1<\/dd><select>/);
	});

	it("fills the Theme options from the Themes, so the Theme item never misses a Theme", () => {
		const options = [...document.querySelectorAll<HTMLOptionElement>('[data-menu-item="theme"] option')];

		expect(PAGE).not.toContain("<!--theme-options-->");
		expect(options.map((option) => [option.value, option.textContent])).toEqual([
			["paper", "Paper"],
			["board", "Board"],
			["dungeon", "Dungeon"],
		]);
	});

	it("fails on a page with no mark for the Theme options", () => {
		expect(() =>
			titleScreenPage(
				"<li><!--level-features--></li><dd><!--level-rooms--></dd><dd><!--level-exhibits--></dd><dd><!--level-bugs--></dd>",
			),
		).toThrow(/theme-options/);
	});

	it("fails on a page with no mark for the default Theme", () => {
		expect(() =>
			titleScreenPage(
				"<li><!--level-features--></li><dd><!--level-rooms--></dd><dd><!--level-exhibits--></dd><dd><!--level-bugs--></dd><select><!--theme-options--></select>",
			),
		).toThrow(/default-theme/);
	});

	it("fails on a page with no mark for a count, so a count never goes missing", () => {
		expect(() => titleScreenPage("<li><!--level-features--></li><dd><!--level-rooms--></dd>")).toThrow(
			/level-exhibits/,
		);
	});

	it("fills the real page from the real Level", () => {
		expect(PAGE).not.toMatch(/<!--level-/);
		expect(document.querySelector("[data-title-screen]")?.textContent).toMatch(
			/\d+ Rooms?, \d+ Exhibits?, \d+ Bugs? to fix/,
		);
	});

	it("shows the Level counts in the Dungeon stat boxes: Rooms, Exhibits, and Bugs", () => {
		const level = loadLevel(sampleLevel);
		const stats = [...document.querySelectorAll(".title-screen__stat")].map((stat) => [
			stat.querySelector("dt")?.textContent,
			stat.querySelector("dd")?.textContent,
		]);

		expect(stats).toEqual([
			["Rooms", `${level.rooms.length}`],
			["Exhibits", `${level.exhibits.length}`],
			["Bugs", `${level.bugSpawns.length}`],
		]);
	});
});

describe("Title Screen page", () => {
	it("has the page title and no em dash in its copy", () => {
		expect(PAGE).toContain("<title>Luan Afonso, portfolio</title>");
		expect(PAGE).not.toContain("\u2014");
		expect(PAGE).not.toContain("&mdash;");
	});

	it("keeps the Paper chip for the menu: pins 1 to 3 are the menu items, and the other pins are NC", () => {
		const pins = [...document.querySelectorAll(".pinout__label")];
		const menu = pins.filter((pin) => pin.querySelector("[data-menu-item]"));
		const others = pins.filter((pin) => !pin.querySelector("[data-menu-item]"));

		expect(menu.map((pin) => pin.querySelector(".pinout__num")?.textContent)).toEqual(["1", "2", "3"]);
		expect(others.map((pin) => pin.querySelector(".pinout__name")?.textContent)).toEqual(["NC", "NC", "NC"]);
		expect(document.querySelector(".pinout")?.querySelector("kbd")).toBeNull();
	});

	it("lists in the Paper Table 1 the same controls as the Dungeon How to Play", () => {
		const table = document.querySelector("table.title-screen__controls");
		const cells = [...(table?.querySelectorAll("tbody td") ?? [])].map((cell) => cell.textContent ?? "");
		const paperKeys = cells.filter((_, i) => i % 2 === 0);
		const dungeonKeys = [...document.querySelectorAll(".title-screen__rules dt")].map((term) =>
			[...term.querySelectorAll("kbd")].map((key) => key.textContent).join(""),
		);

		expect(table?.querySelector("caption")?.textContent).toBe("Table 1. Controls");
		expect(table?.closest("figure")).toBeNull();
		expect(paperKeys.sort()).toEqual(dungeonKeys.sort());
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
		pointAt(newGame());
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

	it("grows from the ink plate in Dungeon", async () => {
		document.documentElement.dataset.theme = "dungeon";
		const plate = document.querySelector<HTMLElement>("[data-ink-plate]");
		vi.spyOn(plate as HTMLElement, "getBoundingClientRect").mockReturnValue(rect(80, 70, 480, 360));
		await click();

		const style = (name: string) => dive()?.style.getPropertyValue(name);
		expect([style("--dive-top"), style("--dive-right"), style("--dive-bottom"), style("--dive-left")]).toEqual([
			"80px",
			"450px",
			"160px",
			"70px",
		]);
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
		pointAt(newGame());
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

describe("Dungeon loading die", () => {
	const die = () => document.querySelector<HTMLElement>("[data-die]");
	const face = () => die()?.dataset.face;

	beforeEach(() => {
		document.documentElement.dataset.theme = "dungeon";
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	/** Clicks NEW GAME before the game is ready, and waits out the dive, so the loading state shows. */
	async function loading() {
		const setup = setUp();
		newGame().click();
		await vi.advanceTimersByTimeAsync(1000);
		expect(loadingBar()?.hidden).toBe(false);
		return setup;
	}

	it("sits on the loading state with the line Loading the game.", () => {
		expect(loadingBar()?.contains(die() as HTMLElement)).toBe(true);
		expect(loadingBar()?.querySelector(".only-dungeon")?.textContent).toContain("Loading the game.");
	});

	it("steps to a new face every 140 ms while the game loads, then stops", async () => {
		motion("no-preference");
		const { resolve } = await loading();

		const faces = [face()];
		for (let step = 0; step < 6; step++) {
			await vi.advanceTimersByTimeAsync(140);
			faces.push(face());
		}
		// Each step shows the next face of the roll 3, 6, 1, 5, 2, 4, wrapping: six steps show every face once.
		expect("361524361524").toContain(faces.slice(1).join(""));

		resolve("the game");
		await vi.advanceTimersByTimeAsync(0);
		const last = face();
		await vi.advanceTimersByTimeAsync(1000);
		expect(face()).toBe(last);
	});

	it("stays still under reduced motion", async () => {
		await loading();
		const first = face();

		await vi.advanceTimersByTimeAsync(1000);

		expect(face()).toBe(first);
	});
});

describe("Title Screen in every look", () => {
	it.each(THEMES)("works the same in %s: hover, focus, the arrow keys, and Enter", (theme) => {
		document.documentElement.dataset.theme = theme;
		const { navigate } = setUp();

		pointAt(themeItem());
		expect(isSelected(themeItem())).toBe(true);
		newGame().focus();
		expect(isSelected(newGame())).toBe(true);
		press("ArrowDown");
		expect(document.activeElement).toBe(skip());
		expect(isSelected(skip())).toBe(true);
		press("Enter");
		expect(navigate).toHaveBeenCalledTimes(1);
	});

	it("keeps the menu usable while the game loads", () => {
		const { navigate } = setUp();
		newGame().click();
		expect(loadingBar()?.hidden).toBe(false);

		press("ArrowDown");
		press("Enter");

		expect(navigate).toHaveBeenCalledTimes(1);
	});

	it("names the Dungeon error as a blocked way, with the same reason and recovery", async () => {
		const { reject } = setUp();
		vi.spyOn(console, "error").mockImplementation(() => {});
		newGame().click();
		reject(new Error("offline"));
		await settle();

		expect(loadError()?.querySelector(".only-dungeon")?.textContent).toBe("The way is blocked.");
		expect(loadError()?.querySelector("[data-load-error-text]")?.textContent).toMatch(/choose NEW GAME to reload/);
	});

	it("lazy-loads the ink plate, only in the Dungeon look, with a text alternative", () => {
		const plate = document.querySelector<HTMLImageElement>("img[data-ink-plate]");

		expect(plate?.getAttribute("loading")).toBe("lazy");
		expect(plate?.getAttribute("src")).toBe("/dungeon/title/ink-plate.png");
		expect(plate?.alt).toMatch(/ink drawing/);
		expect(plate?.closest(".only-dungeon")).not.toBeNull();
	});
});
