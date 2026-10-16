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

/** A color as red, green, and blue values from 0 to 255. */
export type Rgb = readonly [red: number, green: number, blue: number];

/** The sound events of the Game core. */
export type SoundEvent = "shot" | "door-open";

/** The colors of the HUD: the crosshair, the status bar, and the hint above it. */
export interface HudColors {
	/** The big values in the status bar. */
	value: Rgb;
	/** The small labels above the values. */
	label: Rgb;
	/** The hint above the status bar, like "Press E". */
	hint: Rgb;
	/** The shadow under the hint, one pixel down and right. */
	hintShadow: Rgb;
	crosshair: Rgb;
	/** The status bar and its top edge. */
	bar: Rgb;
	barEdge: Rgb;
	/** Each section box of the status bar, with its sunken bevel. */
	section: Rgb;
	bevelDark: Rgb;
	bevelLight: Rgb;
}

/**
 * An art set: everything the game draws and plays. The Level, the Bugs, the HUD, and the Audio
 * read their art from it, so a new Theme can bring new art without code changes.
 * The engine never sees it (ADR 0001).
 */
export interface ArtSet {
	/** A short name for error messages. */
	name: string;
	/**
	 * The folder under `public/` that holds the files: `textures/<name>.png`, `sprites/<name>.png`
	 * with their anchors in `sprites/offsets.json`, and `sounds/<file>.wav`.
	 */
	folder: string;
	/** The wall, door, and door track textures a Level may name. */
	textures: readonly string[];
	/** The frames of a walking Bug, in order. A Level with Bugs needs at least one. */
	bugWalkFrames: readonly string[];
	/** The frames of a Bug being fixed, in order. A Level with Bugs needs at least one. */
	bugFixFrames: readonly string[];
	/** The WAV file (with no extension) of each sound event. */
	sounds: Readonly<Record<SoundEvent, string>>;
	hud: Readonly<HudColors>;
}

/**
 * The machine art set, which the Paper and Board Themes share. For now it still points at the
 * Freedoom art, so the game looks and sounds as before; the generated machine art replaces it.
 */
export const MACHINE_ART_SET: ArtSet = {
	name: "machine",
	folder: "freedoom",
	textures: ["COMP2", "DOOR3", "DOORTRAK", "STARTAN2", "STARTAN3", "TEKWALL1"],
	// Freedoom's SKUL: two front-view frames walk; six frames show it being fixed.
	bugWalkFrames: ["SKULA1", "SKULB1"],
	bugFixFrames: ["SKULF0", "SKULG0", "SKULH0", "SKULI0", "SKULJ0", "SKULK0"],
	sounds: { shot: "DSPISTOL", "door-open": "DSDOROPN" },
	hud: {
		value: [220, 40, 32],
		label: [200, 196, 180],
		hint: [255, 216, 72],
		hintShadow: [0, 0, 0],
		crosshair: [240, 232, 160],
		bar: [92, 88, 80],
		barEdge: [150, 144, 132],
		section: [48, 44, 40],
		bevelDark: [32, 30, 28],
		bevelLight: [136, 130, 118],
	},
};
