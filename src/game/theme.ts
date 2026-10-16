/**
 * The Themes: the named looks of the whole portfolio (see `GLOSSARY.md`).
 * A Theme is an art set (what the game draws and plays) plus a look for the HTML surfaces.
 * This module has no imports, so the Title Screen can use it without game code.
 */
export const THEMES = ["paper", "board"] as const;

export type Theme = (typeof THEMES)[number];

/** The name of each Theme, as the Title Screen and the Pause Menu show it. */
export const THEME_LABELS: Readonly<Record<Theme, string>> = {
	paper: "Paper",
	board: "Board",
};

export function isTheme(value: unknown): value is Theme {
	return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}
