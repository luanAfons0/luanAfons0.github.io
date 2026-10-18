import "./pause-menu.css";
import { MOUSE_SENSITIVITY_RANGE, type Settings } from "./settings";
import { isTheme, shownTheme, THEME_LABELS, THEMES, type Theme } from "./theme";

/** The Skip View page, next to the game page. */
export const SKIP_VIEW_URL = `${import.meta.env.BASE_URL}skip/`;

export interface PauseMenuOptions {
	/** The element the overlay goes into. */
	parent: HTMLElement;
	/** The settings at the start. From then on the menu owns them: each change goes out through `onSettingsChange`. */
	settings: Settings;
	onResume(): void;
	/** Runs after each settings change, with all the settings. The caller applies and saves them as they are. */
	onSettingsChange(settings: Settings): void;
	/** Sends the `theme/<id>` analytics event when the player switches the Theme. */
	track(event: `theme/${Theme}`): void;
	/**
	 * Runs after the player switches the Theme, after `onSettingsChange`: the caller changes the game
	 * art to the art set of the Theme. When it fails (the art did not load), the menu sets the Theme
	 * back, reports the settings again, and shows one line until the next Theme choice, unless the
	 * player chose another Theme since.
	 */
	onThemeChange(theme: Theme): Promise<void>;
}

/** The Bugs fixed and the Bug total of the Level, as the Game core reports them. */
export interface BugsFixed {
	fixed: number;
	total: number;
}

export interface PauseMenu {
	/** Opens the menu with the Bugs fixed so far: the Dungeon look ticks one box per fixed Bug. */
	open(bugs: BugsFixed): void;
	close(): void;
	isOpen(): boolean;
	/** The M key: turns the sound setting on or off, shows it, and reports the settings, open or closed. */
	toggleSound(): void;
}

/**
 * The Pause Menu: an HTML overlay above the canvas. In Paper and Board it is a board panel: the
 * toggles are DIP switches and the Theme is a three-position slide switch (Paper, Board, Dungeon).
 * In Dungeon the same markup is the Adventure Sheet: boxed fields with tick boxes, and a Bugs fixed
 * field (only in Dungeon) with one tick box per Bug. All controls are native inputs (checkboxes and
 * one radio group), so they keep their roles, states, and keyboard use in every Theme.
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
		<div class="pause-menu__panel board-surface board-surface--quiet dungeon-pulp">
			<h2 class="pause-menu__title" id="pause-menu-title">Paused</h2>
			<p class="pause-menu__sub only-dungeon">Adventure Sheet</p>
			<button class="pause-menu__item pause-menu__resume" type="button">Resume <small class="only-dungeon">back to the keep</small></button>
			<hr class="pause-menu__sep" />
			<div class="pause-menu__fields">
				<label class="pause-menu__row pause-menu__row--wide">
					<span class="pause-menu__name">Mouse sensitivity</span>
					<span class="pause-menu__control">
						<input class="pause-menu__range" name="mouseSensitivity" type="range" min="${min}" max="${max}" step="${step}" />
						<output></output>
					</span>
				</label>
				<label class="pause-menu__row">
					<span class="pause-menu__name"><span class="pause-menu__full-name">Invert mouse</span><span class="only-dungeon" aria-hidden="true">Mouse</span></span>
					<span class="pause-menu__control pause-menu__silk">
						<input class="pause-menu__dip" name="invertMouse" type="checkbox" />
						<span class="pause-menu__legend" aria-hidden="true"></span>
						<span class="only-dungeon" aria-hidden="true">Invert</span>
					</span>
				</label>
				<label class="pause-menu__row">
					<span class="pause-menu__name">Sound <kbd>M</kbd></span>
					<span class="pause-menu__control pause-menu__silk">
						<input class="pause-menu__dip" name="sound" type="checkbox" />
						<span class="pause-menu__legend" aria-hidden="true"></span>
						<span class="only-dungeon" aria-hidden="true">On</span>
					</span>
				</label>
				<div class="pause-menu__row pause-menu__row--wide">
					<span class="pause-menu__name" id="pause-menu-theme">Theme</span>
					<span class="pause-menu__control pause-menu__silk pause-menu__slide" role="radiogroup" aria-labelledby="pause-menu-theme">
						${THEMES.map(
							(theme) =>
								`<label class="pause-menu__position"><input name="theme" type="radio" value="${theme}" /><span>${THEME_LABELS[theme]}</span></label>`,
						).join("")}
					</span>
				</div>
				<p class="pause-menu__error" role="alert" hidden></p>
				<div class="pause-menu__row pause-menu__row--wide pause-menu__bugs only-dungeon" role="group">
					<span class="pause-menu__name">Bugs fixed</span>
					<span class="pause-menu__tally" aria-hidden="true"></span>
				</div>
			</div>
			<hr class="pause-menu__sep" />
			<a class="pause-menu__item" href="${SKIP_VIEW_URL}">Skip View <small class="only-dungeon">read without playing</small></a>
			<p class="pause-menu__hint">Read the portfolio without playing.</p>
		</div>`;

	const resume = query<HTMLButtonElement>(root, ".pause-menu__resume");
	const sensitivity = query<HTMLInputElement>(root, 'input[name="mouseSensitivity"]');
	const sensitivityValue = query<HTMLOutputElement>(root, "output");
	const invertMouse = query<HTMLInputElement>(root, 'input[name="invertMouse"]');
	const sound = query<HTMLInputElement>(root, 'input[name="sound"]');
	const themes = [...root.querySelectorAll<HTMLInputElement>('input[name="theme"]')];
	const themeError = query<HTMLParagraphElement>(root, ".pause-menu__error");
	const bugsField = query<HTMLDivElement>(root, ".pause-menu__bugs");
	const tally = query<HTMLSpanElement>(root, ".pause-menu__tally");

	/** One tick box per Bug, ticked when it is fixed, then "N of M". No Bugs: no field. */
	const showBugs = ({ fixed, total }: BugsFixed) => {
		bugsField.hidden = total === 0;
		bugsField.setAttribute("aria-label", `Bugs fixed: ${fixed} of ${total}`);
		const boxes = Array.from({ length: total }, (_, index) => {
			const box = document.createElement("span");
			if (index < fixed) box.className = "is-done";
			return box;
		});
		const count = document.createElement("b");
		count.textContent = `${fixed} of ${total}`;
		tally.replaceChildren(...boxes, count);
	};

	// The Theme shown is data-theme on the page root: the saved Theme, or the default Theme.
	const page = options.parent.ownerDocument.documentElement;

	const showSettings = () => {
		sensitivity.value = String(settings.mouseSensitivity);
		sensitivityValue.value = settings.mouseSensitivity.toFixed(1);
		invertMouse.checked = settings.invertMouse;
		sound.checked = settings.sound;
		const theme = shownTheme(page);
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
		open(bugs) {
			// The Title Screen may have changed the Theme since this menu was made.
			showSettings();
			showBugs(bugs);
			root.hidden = false;
			resume.focus();
		},
		close() {
			root.hidden = true;
		},
		isOpen: () => !root.hidden,
		toggleSound() {
			settings.sound = !settings.sound;
			showSettings();
			options.onSettingsChange({ ...settings });
		},
	};
}

function query<T extends Element>(root: Element, selector: string): T {
	const element = root.querySelector<T>(selector);
	if (!element) throw new Error(`The Pause Menu has no ${selector}.`);
	return element;
}
