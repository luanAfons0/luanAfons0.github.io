// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPauseMenu, type PauseMenuOptions } from "./pause-menu";
import { DEFAULT_SETTINGS, type Settings } from "./settings";

const page = document.documentElement;

/** Bugs fixed and the Bug total of a Level, as the Game core reports them. */
const BUGS = { fixed: 3, total: 7 };

function setup(overrides: Partial<PauseMenuOptions> = {}) {
	const changes: Settings[] = [];
	const events: string[] = [];
	const themeChanges: string[] = [];
	const menu = createPauseMenu({
		parent: document.body,
		settings: { ...DEFAULT_SETTINGS },
		onResume: () => {},
		onSettingsChange: (settings) => changes.push(settings),
		track: (event) => events.push(event),
		onThemeChange: async (theme) => {
			themeChanges.push(theme);
		},
		...overrides,
	});
	const radio = (theme: string) => {
		const input = document.querySelector<HTMLInputElement>(`.pause-menu input[name="theme"][value="${theme}"]`);
		if (!input) throw new Error(`no ${theme} Theme input`);
		return input;
	};
	const message = () => document.querySelector<HTMLElement>(".pause-menu__error");
	return { menu, changes, events, themeChanges, radio, message };
}

/** Lets the Theme change promises settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A failed art load logs its error; the tests only check what the player sees. */
const quietErrors = () => vi.spyOn(console, "error").mockImplementation(() => {});

afterEach(() => {
	vi.restoreAllMocks();
	document.body.innerHTML = "";
	delete page.dataset.theme;
	localStorage.clear();
});

describe("Pause Menu", () => {
	it("shows the Theme on the page root when it opens", () => {
		page.dataset.theme = "board";
		const { menu, radio } = setup();
		menu.open(BUGS);
		expect(radio("board").checked).toBe(true);
		expect(radio("paper").checked).toBe(false);
	});

	it("shows a Theme that changed on the page after it was created", () => {
		page.dataset.theme = "board";
		const { menu, radio } = setup();
		page.dataset.theme = "paper";
		menu.open(BUGS);
		expect(radio("paper").checked).toBe(true);
	});

	it("shows the default Theme, Dungeon, when the page root has no Theme", () => {
		const { menu, radio } = setup();
		menu.open(BUGS);
		expect(radio("dungeon").checked).toBe(true);
	});

	it("switches the page Theme, reports the setting, and sends the analytics event", () => {
		page.dataset.theme = "paper";
		const { menu, radio, changes, events } = setup();
		menu.open(BUGS);
		radio("board").click();
		expect(page.dataset.theme).toBe("board");
		expect(changes.at(-1)).toEqual({ ...DEFAULT_SETTINGS, theme: "board" });
		expect(events).toEqual(["theme/board"]);
	});

	it("keeps native inputs: a range, two checkboxes, and one Theme radio group of three", () => {
		setup();
		const types = [...document.querySelectorAll<HTMLInputElement>(".pause-menu input")].map((input) => input.type);
		expect(types).toEqual(["range", "checkbox", "checkbox", "radio", "radio", "radio"]);
		const radios = [...document.querySelectorAll<HTMLInputElement>('.pause-menu input[type="radio"]')];
		expect(radios.map((input) => input.name)).toEqual(["theme", "theme", "theme"]);
		expect(radios.map((input) => input.labels?.[0]?.textContent?.trim())).toEqual(["Paper", "Board", "Dungeon"]);
		expect(radios.every((input) => input.closest('[role="radiogroup"]') !== null)).toBe(true);
		const group = document.querySelector('.pause-menu [role="radiogroup"]');
		expect(group?.getAttribute("aria-labelledby")).toBeTruthy();
		const labelId = group?.getAttribute("aria-labelledby") ?? "";
		expect(document.getElementById(labelId)?.textContent).toBe("Theme");
	});

	it.each(["paper", "board"])("shows Dungeon in %s and switches to it", async (from) => {
		page.dataset.theme = from;
		const { menu, radio, changes, events, themeChanges } = setup();
		menu.open(BUGS);
		radio("dungeon").click();
		expect(page.dataset.theme).toBe("dungeon");
		expect(changes.at(-1)).toEqual({ ...DEFAULT_SETTINGS, theme: "dungeon" });
		expect(events).toEqual(["theme/dungeon"]);
		expect(themeChanges).toEqual(["dungeon"]);

		menu.close();
		menu.open(BUGS);
		expect(radio("dungeon").checked).toBe(true);
	});

	it("sets the Theme back and shows one line when the art of the new Theme does not load", async () => {
		quietErrors();
		page.dataset.theme = "board";
		const { menu, radio, changes, message } = setup({
			settings: { ...DEFAULT_SETTINGS, theme: "board" },
			onThemeChange: () => Promise.reject(new Error("HTTP 404")),
		});
		menu.open(BUGS);
		expect(message()?.hidden).toBe(true);

		radio("dungeon").click();
		await settle();

		expect(page.dataset.theme).toBe("board");
		expect(radio("board").checked).toBe(true);
		expect(changes.at(-1)).toEqual({ ...DEFAULT_SETTINGS, theme: "board" });
		expect(message()?.hidden).toBe(false);
		expect(message()?.textContent).toBe("The Dungeon art did not load. Check your connection and try again.");
		expect(message()?.getAttribute("role")).toBe("alert");
	});

	it("goes back to the default Theme when no Theme was saved before the failed load", async () => {
		quietErrors();
		page.dataset.theme = "dungeon";
		const { menu, radio, changes } = setup({ onThemeChange: () => Promise.reject(new Error("offline")) });
		menu.open(BUGS);
		radio("board").click();
		await settle();

		expect(page.dataset.theme).toBe("dungeon");
		expect(radio("dungeon").checked).toBe(true);
		expect(changes.at(-1)).toEqual(DEFAULT_SETTINGS);
	});

	it("toggles the sound setting for the M key: it shows the change and reports all the settings", () => {
		const { menu, changes } = setup();
		menu.open(BUGS);
		const sound = document.querySelector<HTMLInputElement>('.pause-menu input[name="sound"]');

		menu.toggleSound();

		expect(sound?.checked).toBe(false);
		expect(changes.at(-1)).toEqual({ ...DEFAULT_SETTINGS, sound: false });
		menu.toggleSound();
		expect(sound?.checked).toBe(true);
		expect(changes.at(-1)).toEqual(DEFAULT_SETTINGS);
	});

	it("reports no Theme on the M key after a failed load set the Theme back to none", async () => {
		quietErrors();
		page.dataset.theme = "dungeon";
		const { menu, radio, changes } = setup({ onThemeChange: () => Promise.reject(new Error("offline")) });
		menu.open(BUGS);
		radio("board").click();
		await settle();

		menu.toggleSound();

		expect(changes.at(-1)).toEqual({ ...DEFAULT_SETTINGS, sound: false });
	});

	it("keeps the line of a load that failed after Resume until the player chooses a Theme again", async () => {
		quietErrors();
		page.dataset.theme = "dungeon";
		let failBoard: (error: Error) => void = () => {};
		const { menu, radio, message } = setup({
			onThemeChange: () =>
				new Promise((_, reject) => {
					failBoard = reject;
				}),
		});
		menu.open(BUGS);
		radio("board").click();
		menu.close();
		failBoard(new Error("offline"));
		await settle();

		menu.open(BUGS);

		expect(page.dataset.theme).toBe("dungeon");
		expect(radio("dungeon").checked).toBe(true);
		expect(message()?.hidden).toBe(false);
		expect(message()?.textContent).toBe("The Board art did not load. Check your connection and try again.");
		menu.close();
		menu.open(BUGS);
		expect(message()?.hidden).toBe(false);
		radio("paper").click();
		expect(message()?.hidden).toBe(true);
	});

	it("ignores a failed load when the player chose another Theme since, and hides the line on the next choice", async () => {
		quietErrors();
		page.dataset.theme = "board";
		let failDungeon: (error: Error) => void = () => {};
		const { menu, radio, message } = setup({
			onThemeChange: (theme) =>
				theme === "dungeon"
					? new Promise((_, reject) => {
							failDungeon = reject;
						})
					: Promise.resolve(),
		});
		menu.open(BUGS);
		radio("dungeon").click();
		radio("paper").click();
		failDungeon(new Error("late"));
		await settle();

		expect(page.dataset.theme).toBe("paper");
		expect(message()?.hidden).toBe(true);

		radio("dungeon").click();
		failDungeon(new Error("offline"));
		await settle();
		expect(message()?.hidden).toBe(false);
		radio("board").click();
		expect(message()?.hidden).toBe(true);
	});

	it("shows the Bugs fixed as ticked boxes and N of M", () => {
		const { menu } = setup();
		menu.open({ fixed: 3, total: 7 });
		const tally = document.querySelector<HTMLElement>(".pause-menu__bugs");
		expect(tally?.hidden).toBe(false);
		expect(tally?.getAttribute("aria-label")).toBe("Bugs fixed: 3 of 7");
		const boxes = [...document.querySelectorAll(".pause-menu__tally > span")];
		expect(boxes).toHaveLength(7);
		expect(boxes.map((box) => box.classList.contains("is-done"))).toEqual([
			true,
			true,
			true,
			false,
			false,
			false,
			false,
		]);
		expect(document.querySelector(".pause-menu__tally b")?.textContent).toBe("3 of 7");
	});

	it("shows the Bugs fixed at the time it opens", () => {
		const { menu } = setup();
		menu.open({ fixed: 1, total: 7 });
		menu.close();
		menu.open({ fixed: 7, total: 7 });
		expect(document.querySelectorAll(".pause-menu__tally > span.is-done")).toHaveLength(7);
		expect(document.querySelector(".pause-menu__tally b")?.textContent).toBe("7 of 7");
	});

	it("shows no Bugs fixed field when the Level has no Bugs", () => {
		const { menu } = setup();
		menu.open({ fixed: 0, total: 0 });
		expect(document.querySelector<HTMLElement>(".pause-menu__bugs")?.hidden).toBe(true);
	});

	it("names the checkboxes by their setting only", () => {
		setup();
		// The accessible name of a wrapped input: its label's text, without the parts hidden from screen readers.
		const names = [...document.querySelectorAll<HTMLInputElement>('.pause-menu input[type="checkbox"]')].map(
			(input) => {
				const label = input.closest("label")?.cloneNode(true) as HTMLElement | undefined;
				for (const hidden of label?.querySelectorAll('[aria-hidden="true"]') ?? []) hidden.remove();
				return label?.textContent?.replace(/\s+/g, " ").trim();
			},
		);
		expect(names).toEqual(["Invert mouse", "Sound M"]);
	});
});
