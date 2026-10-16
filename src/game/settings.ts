import { isTheme, type Theme } from "./theme";

/**
 * The player's settings, saved in `localStorage` between visits.
 * Only settings are saved: game progress is not, so each visit starts a fresh Level.
 * Storage can fail (private windows, blocked site data), so every access is in a
 * try/catch and the game falls back to the defaults.
 * The Title Screen reads and writes them too (the Theme), so this module imports only the Theme module.
 */
export interface Settings {
	/** Multiplies the mouse turn. 1 is the default speed. */
	mouseSensitivity: number;
	/** Mouse movement to the right turns the player left. */
	invertMouse: boolean;
	sound: boolean;
	/**
	 * The Theme the visitor chose. Missing means "follow the system": a light system setting shows
	 * Paper and a dark one shows Board. The head script in index.html reads it from the same key.
	 */
	theme?: Theme;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = {
	mouseSensitivity: 1,
	invertMouse: false,
	sound: true,
};

export const MOUSE_SENSITIVITY_RANGE = { min: 0.2, max: 3, step: 0.1 } as const;

/** The storage key. The head script in index.html reads the Theme from it too: change both together. */
const STORAGE_KEY = "portfolio.settings.v1";

/** Reads the saved settings. A missing, broken, or unreadable value gives the default. */
export function loadSettings(): Settings {
	let saved: unknown;
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		saved = raw === null ? undefined : JSON.parse(raw);
	} catch {
		saved = undefined;
	}
	const values = typeof saved === "object" && saved !== null ? (saved as Record<string, unknown>) : {};
	const sensitivity = values.mouseSensitivity;
	return {
		mouseSensitivity:
			typeof sensitivity === "number" && Number.isFinite(sensitivity)
				? Math.min(MOUSE_SENSITIVITY_RANGE.max, Math.max(MOUSE_SENSITIVITY_RANGE.min, sensitivity))
				: DEFAULT_SETTINGS.mouseSensitivity,
		invertMouse: typeof values.invertMouse === "boolean" ? values.invertMouse : DEFAULT_SETTINGS.invertMouse,
		sound: typeof values.sound === "boolean" ? values.sound : DEFAULT_SETTINGS.sound,
		...(isTheme(values.theme) ? { theme: values.theme } : {}),
	};
}

/** Saves the settings. When storage fails, the settings still apply for this visit. */
export function saveSettings(settings: Settings): void {
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
	} catch {
		// Storage is full, blocked, or missing. Nothing else to do.
	}
}
