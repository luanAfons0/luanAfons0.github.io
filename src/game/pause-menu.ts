import { MOUSE_SENSITIVITY_RANGE, type Settings } from "./settings";

/** The Skip View page, next to the game page. */
export const SKIP_VIEW_URL = `${import.meta.env.BASE_URL}skip/`;

export interface PauseMenuOptions {
	/** The element the overlay goes into. */
	parent: HTMLElement;
	settings: Settings;
	onResume(): void;
	/** Runs after each settings change, with all the settings. */
	onSettingsChange(settings: Settings): void;
}

export interface PauseMenu {
	open(): void;
	close(): void;
	isOpen(): boolean;
}

/** The Pause Menu: an HTML overlay above the canvas. */
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
		<div class="pause-menu__panel">
			<h2 class="pause-menu__title" id="pause-menu-title">Paused</h2>
			<button class="pause-menu__item pause-menu__resume" type="button">Resume</button>
			<label class="pause-menu__setting">
				<span>Mouse sensitivity</span>
				<input name="mouseSensitivity" type="range" min="${min}" max="${max}" step="${step}" />
				<output></output>
			</label>
			<label class="pause-menu__setting">
				<span>Invert mouse</span>
				<input name="invertMouse" type="checkbox" />
			</label>
			<label class="pause-menu__setting">
				<span>Sound</span>
				<input name="sound" type="checkbox" />
			</label>
			<a class="pause-menu__item" href="${SKIP_VIEW_URL}">Skip View</a>
			<p class="pause-menu__hint">Read the portfolio without playing.</p>
		</div>`;

	const resume = query<HTMLButtonElement>(root, ".pause-menu__resume");
	const sensitivity = query<HTMLInputElement>(root, 'input[name="mouseSensitivity"]');
	const sensitivityValue = query<HTMLOutputElement>(root, "output");
	const invertMouse = query<HTMLInputElement>(root, 'input[name="invertMouse"]');
	const sound = query<HTMLInputElement>(root, 'input[name="sound"]');

	const showSettings = () => {
		sensitivity.value = String(settings.mouseSensitivity);
		sensitivityValue.value = settings.mouseSensitivity.toFixed(1);
		invertMouse.checked = settings.invertMouse;
		sound.checked = settings.sound;
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

	options.parent.append(root);

	return {
		open() {
			root.hidden = false;
			resume.focus();
		},
		close() {
			root.hidden = true;
		},
		isOpen: () => !root.hidden,
	};
}

function query<T extends Element>(root: Element, selector: string): T {
	const element = root.querySelector<T>(selector);
	if (!element) throw new Error(`The Pause Menu has no ${selector}.`);
	return element;
}
