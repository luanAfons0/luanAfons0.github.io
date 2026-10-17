// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPauseMenu, type PauseMenuOptions } from "./pause-menu";
import { DEFAULT_SETTINGS, type Settings } from "./settings";

const page = document.documentElement;

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
		menu.open();
		expect(radio("board").checked).toBe(true);
		expect(radio("paper").checked).toBe(false);
	});

	it("shows a Theme that changed on the page after it was created", () => {
		page.dataset.theme = "board";
		const { menu, radio } = setup();
		page.dataset.theme = "paper";
		menu.open();
		expect(radio("paper").checked).toBe(true);
	});

	it("shows Paper when no Theme is saved and the system is light", () => {
		const { menu, radio } = setup();
		menu.open();
		expect(radio("paper").checked).toBe(true);
	});

	it("switches the page Theme, reports the setting, and sends the analytics event", () => {
		page.dataset.theme = "paper";
		const { menu, radio, changes, events } = setup();
		menu.open();
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
		menu.open();
		radio("dungeon").click();
		expect(page.dataset.theme).toBe("dungeon");
		expect(changes.at(-1)).toEqual({ ...DEFAULT_SETTINGS, theme: "dungeon" });
		expect(events).toEqual(["theme/dungeon"]);
		expect(themeChanges).toEqual(["dungeon"]);

		menu.close();
		menu.open();
		expect(radio("dungeon").checked).toBe(true);
	});

	it("sets the Theme back and shows one line when the art of the new Theme does not load", async () => {
		quietErrors();
		page.dataset.theme = "board";
		const { menu, radio, changes, message } = setup({
			settings: { ...DEFAULT_SETTINGS, theme: "board" },
			onThemeChange: () => Promise.reject(new Error("HTTP 404")),
		});
		menu.open();
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

	it("goes back to the system look when no Theme was saved before the failed load", async () => {
		quietErrors();
		const { menu, radio, changes } = setup({ onThemeChange: () => Promise.reject(new Error("offline")) });
		menu.open();
		radio("dungeon").click();
		await settle();

		expect(page.dataset.theme).toBeUndefined();
		expect(radio("paper").checked).toBe(true);
		expect(changes.at(-1)).toEqual(DEFAULT_SETTINGS);
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
		menu.open();
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
