import "./pause-menu.css";
import { MOUSE_SENSITIVITY_RANGE, type Settings } from "./settings";
import { isTheme, THEME_LABELS, THEMES, type Theme } from "./theme";

/** The Skip View page, next to the game page. */
export const SKIP_VIEW_URL = `${import.meta.env.BASE_URL}skip/`;

export interface PauseMenuOptions {
	/** The element the overlay goes into. */
	parent: HTMLElement;
	settings: Settings;
	onResume(): void;
	/** Runs after each settings change, with all the settings. The caller saves them. */
	onSettingsChange(settings: Settings): void;
	/** Sends the `theme/<id>` analytics event when the player switches the Theme. */
	track(event: `theme/${Theme}`): void;
	/**
	 * Runs after the player switches the Theme, after `onSettingsChange`: the caller changes the game
	 * art to the art set of the Theme. When it fails (the art did not load), the menu sets the Theme
	 * back, reports the settings again, and shows one line, unless the player chose another Theme since.
	 */
	onThemeChange(theme: Theme): Promise<void>;
}

export interface PauseMenu {
	open(): void;
	close(): void;
	isOpen(): boolean;
	/** Shows settings that changed outside the menu (the M key changes the sound setting). */
	showSettings(settings: Settings): void;
}

/**
 * The Pause Menu: an HTML overlay above the canvas, a board panel in every Theme. The toggles are
 * DIP switches and the Theme is a three-position slide switch (Paper, Board, Dungeon), all drawn
 * over native inputs (checkboxes and one radio group), so they keep their roles, states, and keyboard use.
 * The Theme switch is the same saved `theme` setting as the Theme item of the Title Screen: it
 * switches `data-theme` on the page root at once and reports the change; the caller saves it and
 * changes the game art (`onThemeChange`). A failed change sets the Theme back.
 */
export function createPauseMenu(options: PauseMenuOptions): PauseMenu {
	const settings: Settings = { ...options.settings };
	const { min, max, step } = MOUSE_SENSITIVITY_RANGE;

	const root = document.createElement("div");
	root.className = "pause-menu";
	root.hidden = true;
	root.setAttribute("role", "dialog");
	root.setAttribute("aria-modal", "true");
	root.setAttribute("aria-labelledby", "pause-menu-title");
	root.innerHTML = `
		<div class="pause-menu__panel board-surface board-surface--quiet">
			<h2 class="pause-menu__title" id="pause-menu-title">Paused</h2>
			<button class="pause-menu__item pause-menu__resume" type="button">Resume</button>
			<hr class="pause-menu__sep" />
			<label class="pause-menu__row">
				<span>Mouse sensitivity</span>
				<span class="pause-menu__control">
					<input class="pause-menu__range" name="mouseSensitivity" type="range" min="${min}" max="${max}" step="${step}" />
					<output></output>
				</span>
			</label>
			<label class="pause-menu__row">
				<span>Invert mouse</span>
				<span class="pause-menu__control pause-menu__silk">
					<input class="pause-menu__dip" name="invertMouse" type="checkbox" />
					<span class="pause-menu__legend" aria-hidden="true"></span>
				</span>
			</label>
			<label class="pause-menu__row">
				<span>Sound <kbd>M</kbd></span>
				<span class="pause-menu__control pause-menu__silk">
					<input class="pause-menu__dip" name="sound" type="checkbox" />
					<span class="pause-menu__legend" aria-hidden="true"></span>
				</span>
			</label>
			<div class="pause-menu__row">
				<span id="pause-menu-theme">Theme</span>
				<span class="pause-menu__control pause-menu__silk pause-menu__slide" role="radiogroup" aria-labelledby="pause-menu-theme">
					${THEMES.map(
						(theme) =>
							`<label class="pause-menu__position"><input name="theme" type="radio" value="${theme}" /><span>${THEME_LABELS[theme]}</span></label>`,
					).join("")}
				</span>
			</div>
			<p class="pause-menu__error" role="alert" hidden></p>
			<hr class="pause-menu__sep" />
			<a class="pause-menu__item" href="${SKIP_VIEW_URL}">Skip View</a>
			<p class="pause-menu__hint">Read the portfolio without playing.</p>
		</div>`;

	const resume = query<HTMLButtonElement>(root, ".pause-menu__resume");
	const sensitivity = query<HTMLInputElement>(root, 'input[name="mouseSensitivity"]');
	const sensitivityValue = query<HTMLOutputElement>(root, "output");
	const invertMouse = query<HTMLInputElement>(root, 'input[name="invertMouse"]');
	const sound = query<HTMLInputElement>(root, 'input[name="sound"]');
	const themes = [...root.querySelectorAll<HTMLInputElement>('input[name="theme"]')];
	const themeError = query<HTMLParagraphElement>(root, ".pause-menu__error");

	// The Theme shown is data-theme on the page root. With none, the CSS follows the system
	// setting (light gives Paper, dark gives Board), so the switch follows it too.
	const page = options.parent.ownerDocument.documentElement;
	const darkSystem = matchMedia("(prefers-color-scheme: dark)");
	const shownTheme = (): Theme => {
		const theme = page.dataset.theme;
		if (isTheme(theme)) return theme;
		return darkSystem.matches ? "board" : "paper";
	};

	const showSettings = () => {
		sensitivity.value = String(settings.mouseSensitivity);
		sensitivityValue.value = settings.mouseSensitivity.toFixed(1);
		invertMouse.checked = settings.invertMouse;
		sound.checked = settings.sound;
		const theme = shownTheme();
		for (const input of themes) input.checked = input.value === theme;
	};
	showSettings();

	resume.addEventListener("click", () => options.onResume());
	sensitivity.addEventListener("input", () => {
		settings.mouseSensitivity = Number(sensitivity.value);
		sensitivityValue.value = settings.mouseSensitivity.toFixed(1);
		options.onSettingsChange({ ...settings });
	});
	invertMouse.addEventListener("change", () => {
		settings.invertMouse = invertMouse.checked;
		options.onSettingsChange({ ...settings });
	});
	sound.addEventListener("change", () => {
		settings.sound = sound.checked;
		options.onSettingsChange({ ...settings });
	});
	// Each Theme switch gets a number, so a failed change that ends after a later switch changes nothing.
	let themeSwitches = 0;
	for (const input of themes) {
		input.addEventListener("change", () => {
			if (!input.checked || !isTheme(input.value)) return;
			const theme = input.value;
			const before = { shown: page.dataset.theme, saved: settings.theme };
			const switchNumber = ++themeSwitches;
			themeError.hidden = true;
			page.dataset.theme = theme;
			settings.theme = theme;
			options.track(`theme/${theme}`);
			options.onSettingsChange({ ...settings });
			new Promise<void>((resolve) => resolve(options.onThemeChange(theme))).catch((error: unknown) => {
				console.error(error);
				if (switchNumber !== themeSwitches) return;
				if (before.shown === undefined) delete page.dataset.theme;
				else page.dataset.theme = before.shown;
				if (before.saved === undefined) delete settings.theme;
				else settings.theme = before.saved;
				showSettings();
				themeError.textContent = `The ${THEME_LABELS[theme]} art did not load. Check your connection and try again.`;
				themeError.hidden = false;
				options.onSettingsChange({ ...settings });
			});
		});
	}

	options.parent.append(root);

	return {
		open() {
			// The Title Screen may have changed the Theme since this menu was made.
			showSettings();
			themeError.hidden = true;
			root.hidden = false;
			resume.focus();
		},
		close() {
			root.hidden = true;
		},
		isOpen: () => !root.hidden,
		showSettings(changed) {
			Object.assign(settings, changed);
			showSettings();
		},
	};
}

function query<T extends Element>(root: Element, selector: string): T {
	const element = root.querySelector<T>(selector);
	if (!element) throw new Error(`The Pause Menu has no ${selector}.`);
	return element;
}
