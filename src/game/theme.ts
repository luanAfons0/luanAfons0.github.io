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
	/** The one-pixel outline around the hint, so it reads on any wall. */
	hintOutline: Rgb;
	crosshair: Rgb;
	/** The status bar. */
	bar: Rgb;
	/** The one-pixel lines of the status bar: its top edge and the outline of each section. */
	outline: Rgb;
}

/** The kinds of files an art set has, each in its own folder. */
export type AssetKind = "textures" | "sprites" | "sounds";

/**
 * An art set: everything the game draws and plays. The Level, the Bugs, the HUD, and the Audio
 * read their art from it, so a new Theme can bring new art without code changes.
 * The engine never sees it (ADR 0001).
 */
export interface ArtSet {
	/** A short name for error messages. */
	name: string;
	/**
	 * The folder under `public/` of each kind of file: `<textures>/<name>.png`, `<sprites>/<name>.png`
	 * with their anchors in `<sprites>/offsets.json`, and `<sounds>/<file>.wav`.
	 */
	folders: Readonly<Record<AssetKind, string>>;
	/** The wall, door, and door track textures a Level may name. */
	textures: readonly string[];
	/** The frames of a walking Bug, in order. A Level with Bugs needs at least one. */
	bugWalkFrames: readonly string[];
	/** The frames of a Bug being fixed, in order; repeat a frame to hold it. A Level with Bugs needs at least one. */
	bugFixFrames: readonly string[];
	/** The WAV file (with no extension) of each sound event. */
	sounds: Readonly<Record<SoundEvent, string>>;
	/** The flat colors of the ceiling and the floor, shaded by distance like the walls. */
	ceiling: Rgb;
	floor: Rgb;
	hud: Readonly<HudColors>;
}

/**
 * The machine art set, which the Paper and Board Themes share: a circuit board. Its wall textures,
 * Bug frames, and sounds all come from `scripts/machine-art.ts`.
 */
export const MACHINE_ART_SET: ArtSet = {
	name: "machine",
	folders: { textures: "machine/textures", sprites: "machine/sprites", sounds: "machine/sounds" },
	textures: ["board-a", "board-b", "chip", "rack", "door", "door-track"],
	// A beetle: two frames walk. When fixed, three frames flash it and fade it into a silkscreen box,
	// then the "patched" mark (the box with a check) holds for three more.
	bugWalkFrames: ["beetle-walk-1", "beetle-walk-2"],
	bugFixFrames: ["beetle-fix-1", "beetle-fix-2", "beetle-fix-3", "beetle-patched", "beetle-patched", "beetle-patched"],
	sounds: { shot: "shot", "door-open": "door-open" },
	ceiling: [11, 13, 15],
	floor: [22, 27, 30],
	// Silkscreen grey labels, copper values, silkscreen white hint and crosshair, on solder mask.
	hud: {
		value: [224, 138, 79],
		label: [154, 161, 165],
		hint: [233, 235, 230],
		hintOutline: [26, 32, 36],
		crosshair: [233, 235, 230],
		bar: [26, 32, 36],
		outline: [58, 64, 69],
	},
};
