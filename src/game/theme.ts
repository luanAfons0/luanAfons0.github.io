/**
 * The Themes: the named looks of the whole portfolio (see `GLOSSARY.md`).
 * A Theme is an art set (what the game draws and plays) plus a look for the HTML surfaces.
 * This module has no imports, so the Title Screen can use it without game code.
 */
export const THEMES = ["paper", "board", "dungeon"] as const;

export type Theme = (typeof THEMES)[number];

/** The name of each Theme, as the Title Screen and the Pause Menu show it. */
export const THEME_LABELS: Readonly<Record<Theme, string>> = {
	paper: "Paper",
	board: "Board",
	dungeon: "Dungeon",
};

export function isTheme(value: unknown): value is Theme {
	return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/**
 * The Theme a page shows: the saved Theme in `data-theme` on its root, or, with none, the system
 * look (a dark system setting gives Board, a light one Paper). Pass the page root and the
 * `(prefers-color-scheme: dark)` media query.
 */
export function shownTheme(
	root: { readonly dataset: { readonly theme?: string } },
	darkSystem: { readonly matches: boolean },
): Theme {
	const theme = root.dataset.theme;
	if (isTheme(theme)) return theme;
	return darkSystem.matches ? "board" : "paper";
}

/** A color as red, green, and blue values from 0 to 255. */
export type Rgb = readonly [red: number, green: number, blue: number];

/** The sound events of the Game core. */
export const SOUND_EVENTS = ["shot", "door-open"] as const;

export type SoundEvent = (typeof SOUND_EVENTS)[number];

/**
 * The texture roles: the textures a Level names, which belong to no one art set. Each art set
 * maps every role to a file of its own: two plain walls, a feature wall (such as a chip or a torch),
 * a storage wall (such as a rack or a shelf), the door, and the door track (the side walls of a door cell).
 */
export const TEXTURE_ROLES = ["wall-a", "wall-b", "feature", "storage", "door", "door-track"] as const;

export type TextureRole = (typeof TEXTURE_ROLES)[number];

export function isTextureRole(value: unknown): value is TextureRole {
	return typeof value === "string" && (TEXTURE_ROLES as readonly string[]).includes(value);
}

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
	/** The one-pixel outline around the crosshair, so it reads on any wall, or null for none. */
	crosshairOutline: Rgb | null;
	/**
	 * The ink of the Bug tally: a tick box per Bug next to the Bugs fixed value, ticked for each
	 * fixed Bug. Null turns the tally off.
	 */
	tally: Rgb | null;
}

/** The kinds of files an art set has, each in its own folder. */
export type AssetKind = "textures" | "sprites" | "posters" | "sounds";

/**
 * An art set: everything the game draws and plays. The Level, the Bugs, the HUD, and the Audio
 * read their art from it, so a new Theme can bring new art without code changes.
 * The engine never sees it (ADR 0001).
 */
export interface ArtSet {
	/** A short name for error messages. */
	name: string;
	/**
	 * The folder under `public/` of each kind of file: `<textures>/<file>.png`, `<sprites>/<name>.png`
	 * with their anchors in `<sprites>/offsets.json`, `<posters>/<Exhibit id>.png` (see `posterPath`),
	 * and `<sounds>/<file>.wav`.
	 */
	folders: Readonly<Record<AssetKind, string>>;
	/** The PNG file (with no extension) in the textures folder of each texture role. */
	textures: Readonly<Record<TextureRole, string>>;
	/** The frames of a walking Bug, in order. A Level with Bugs needs at least one. */
	bugWalkFrames: readonly string[];
	/** The frames of a Bug being fixed, in order; repeat a frame to hold it. A Level with Bugs needs at least one. */
	bugFixFrames: readonly string[];
	/** The WAV file (with no extension) of each sound event. */
	sounds: Readonly<Record<SoundEvent, string>>;
	/**
	 * The Flats: the PNG file (with no extension) in the textures folder of the ceiling texture and
	 * of the floor texture. A Flat covers one tile and repeats on every tile.
	 */
	flats: Readonly<{ ceiling: string; floor: string }>;
	hud: Readonly<HudColors>;
}

/**
 * The machine art set, which the Paper and Board Themes share: a circuit board. Its wall textures,
 * Flats, Bug frames, posters, and sounds all come from `scripts/machine-art.ts`.
 */
export const MACHINE_ART_SET: ArtSet = {
	name: "machine",
	folders: {
		textures: "machine/textures",
		sprites: "machine/sprites",
		posters: "machine/posters",
		sounds: "machine/sounds",
	},
	textures: {
		"wall-a": "board-a",
		"wall-b": "board-b",
		feature: "chip",
		storage: "rack",
		door: "door",
		"door-track": "door-track",
	},
	// A beetle: two frames walk. When fixed, three frames flash it and fade it into a silkscreen box,
	// then the "patched" mark (the box with a check) holds for three more.
	bugWalkFrames: ["beetle-walk-1", "beetle-walk-2"],
	bugFixFrames: ["beetle-fix-1", "beetle-fix-2", "beetle-fix-3", "beetle-patched", "beetle-patched", "beetle-patched"],
	sounds: { shot: "shot", "door-open": "door-open" },
	// A heat-sink panel grid above, and solder mask with copper traces and vias below.
	flats: { ceiling: "heat-sink", floor: "solder-mask" },
	// Silkscreen grey labels, copper values, silkscreen white hint and crosshair, on solder mask.
	hud: {
		value: [224, 138, 79],
		label: [154, 161, 165],
		hint: [233, 235, 230],
		hintOutline: [26, 32, 36],
		crosshair: [233, 235, 230],
		bar: [26, 32, 36],
		outline: [58, 64, 69],
		crosshairOutline: null,
		tally: null,
	},
};

/**
 * The dungeon art set, of the Dungeon Theme: a torch-lit stone keep. Its wall textures, Flats, Slime
 * Bug frames, banner posters, and sounds all come from `scripts/dungeon-art.ts`.
 */
export const DUNGEON_ART_SET: ArtSet = {
	name: "dungeon",
	folders: {
		textures: "dungeon/textures",
		sprites: "dungeon/sprites",
		posters: "dungeon/posters",
		sounds: "dungeon/sounds",
	},
	textures: {
		"wall-a": "stone-a",
		"wall-b": "stone-b",
		feature: "torch",
		storage: "shelf",
		door: "door",
		"door-track": "door-track",
	},
	// A Slime: two frames walk (squash and stretch). When fixed, it flashes, breaks into drops, and
	// fades into an ink tick box; then the "cleared" mark (the ticked box) holds for three more.
	bugWalkFrames: ["slime-walk-1", "slime-walk-2"],
	bugFixFrames: ["slime-fix-1", "slime-fix-2", "slime-fix-3", "slime-cleared", "slime-cleared", "slime-cleared"],
	sounds: { shot: "shot", "door-open": "door-open" },
	// Timber beams over oak planks above, and flagstones of the cut stone of the walls below.
	flats: { ceiling: "timber", floor: "flagstone" },
	// A pulp paper bar with ink lines, labels, and values, and an ink tick box per Bug next to the
	// Bugs fixed value. The hint and the crosshair are paper with an ink outline.
	hud: {
		value: [23, 23, 23],
		label: [74, 70, 61],
		hint: [224, 217, 197],
		hintOutline: [23, 23, 23],
		crosshair: [224, 217, 197],
		bar: [224, 217, 197],
		outline: [23, 23, 23],
		crosshairOutline: [23, 23, 23],
		tally: [23, 23, 23],
	},
};

/** The art set of each Theme. Paper and Board are two looks of one machine art set. */
const THEME_ART_SETS: Readonly<Record<Theme, ArtSet>> = {
	paper: MACHINE_ART_SET,
	board: MACHINE_ART_SET,
	dungeon: DUNGEON_ART_SET,
};

/**
 * The art set of a Theme: the only place a caller gets an art set. With no Theme, the system
 * setting chooses Paper or Board, which both use the machine art set.
 */
export function artSetOf(theme: Theme | undefined): ArtSet {
	return THEME_ART_SETS[theme ?? "paper"];
}

/** The poster of an Exhibit in an art set: a PNG path relative to `public/`, named by the Exhibit id. */
export function posterPath(artSet: Pick<ArtSet, "folders">, exhibitId: string): string {
	return `${artSet.folders.posters}/${exhibitId}.png`;
}
