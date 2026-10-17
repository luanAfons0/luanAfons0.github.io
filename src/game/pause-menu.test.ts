// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { createPauseMenu, type PauseMenuOptions } from "./pause-menu";
import { DEFAULT_SETTINGS, type Settings } from "./settings";

const page = document.documentElement;

function setup(overrides: Partial<PauseMenuOptions> = {}) {
	const changes: Settings[] = [];
	const events: string[] = [];
	const menu = createPauseMenu({
		parent: document.body,
		settings: { ...DEFAULT_SETTINGS },
		onResume: () => {},
		onSettingsChange: (settings) => changes.push(settings),
		track: (event) => events.push(event),
		...overrides,
	});
	const radio = (theme: string) => {
		const input = document.querySelector<HTMLInputElement>(`.pause-menu input[name="theme"][value="${theme}"]`);
		if (!input) throw new Error(`no ${theme} Theme input`);
		return input;
	};
	return { menu, changes, events, radio };
}

afterEach(() => {
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

	it("keeps native inputs: a range, two checkboxes, and a Theme radio group", () => {
		setup();
		const types = [...document.querySelectorAll<HTMLInputElement>(".pause-menu input")].map((input) => input.type);
		expect(types).toEqual(["range", "checkbox", "checkbox", "radio", "radio"]);
		const group = document.querySelector('.pause-menu [role="radiogroup"]');
		expect(group?.getAttribute("aria-labelledby")).toBeTruthy();
		const labelId = group?.getAttribute("aria-labelledby") ?? "";
		expect(document.getElementById(labelId)?.textContent).toBe("Theme");
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
