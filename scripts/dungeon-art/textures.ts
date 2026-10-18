/**
 * The wall textures: 64x64, one tile high, ported from the approved mock's game frame. The Level
 * names texture roles, and the dungeon art set in `src/game/theme.ts` maps each role to one of
 * these file names.
 */

import { fillRect, type Pixmap, plot, seededRandom } from "../art-kit/pixmap.ts";
import { type GeneratedFile, pngFile } from "./files.ts";
import * as c from "./palette.ts";
import { colorAt, moss, SIZE, stoneWall } from "./stone.ts";

const LAST = SIZE - 1;

/** Each texture by file name. Add a texture here, then map its texture role to it in the art set. */
const TEXTURES: Readonly<Record<string, () => Pixmap>> = {
	"stone-a": stoneA,
	"stone-b": stoneB,
	torch,
	shelf,
	door,
	"door-track": doorTrack,
};

export function textures(): GeneratedFile[] {
	return Object.entries(TEXTURES).map(([name, draw]) => pngFile(`textures/${name}.png`, draw()));
}

/** Even cut stone. */
export function stoneA(): Pixmap {
	return stoneWall(11, false);
}

/** Rough stone with moss low on the wall and a small patch higher up. */
export function stoneB(): Pixmap {
	const t = stoneWall(23, true);
	const random = seededRandom(29);
	moss(t, random, 14, 53, 7);
	moss(t, random, 47, 30, 3);
	return t;
}

/**
 * The flame, 12 columns from x = 26 and 17 rows from y = 9: `r` outer, `o` body, `y` core. The
 * game has no animated textures, so the torch has one flame.
 */
const FLAME_ROWS = [
	"......r.....",
	".....rr.....",
	".....ro.....",
	"....roor....",
	"....rooor...",
	"...rooyor...",
	"...royyor...",
	"..rooyyoor..",
	"..royyyyor..",
	"..royyyyor..",
	".rooyyyyoor.",
	".royyyyyyor.",
	".royyyyyyor.",
	".rooyyyyoor.",
	"..rooyyoor..",
	"...roooor...",
	"....rrrr....",
];
const FLAME_COLORS: Readonly<Record<string, number>> = { r: c.FLAME_LO, o: c.FLAME, y: c.FLAME_HI };
const FLAME_LEFT = 26;
const FLAME_TOP = 9;

/** The torch light, baked in: its center, its reach in texels, and how far in front of the wall it burns. */
const GLOW = { x: 31.5, y: 18, reach: 44, depth: 6 } as const;

/**
 * A torch in an iron sconce on even stone, with soot above the flame. The engine has no lighting
 * (ADR 0001), so the warm light of the flame is baked into the stone around it, as in the mock.
 */
function torch(): Pixmap {
	return torchWall(true);
}

/**
 * The torch wall. With `glowing`, the light of the flame is baked into the stone; without it, a
 * renderer that lights the scene itself (the ink plate) gets the plain wall, as in the mock.
 */
export function torchWall(glowing: boolean): Pixmap {
	const t = stoneWall(41, false);
	const random = seededRandom(43);
	// Soot above the flame, thicker near it.
	for (let y = 1; y < 10; y++) {
		for (let x = 27; x <= 36; x++) {
			if (colorAt(t, x, y) !== c.MORTAR && random() < 0.12 + y * 0.045) plot(t, x, y, c.STONE_LO);
		}
	}
	// The sconce: a wall plate, an arm, and a cup.
	fillRect(t, 29, 33, 34, 46, c.IRON);
	plot(t, 31, 35, c.RIVET);
	plot(t, 32, 44, c.RIVET);
	fillRect(t, 31, 30, 32, 32, c.IRON);
	fillRect(t, 26, 26, 37, 27, c.IRON);
	fillRect(t, 27, 28, 36, 28, c.IRON);
	fillRect(t, 28, 29, 35, 29, c.IRON);
	fillRect(t, 27, 26, 36, 26, c.IRON_HI);
	plot(t, 27, 27, c.RIVET);
	if (glowing) glow(t);
	for (const [row, line] of FLAME_ROWS.entries()) {
		for (const [column, char] of [...line].entries()) {
			const color = FLAME_COLORS[char];
			if (color !== undefined) plot(t, FLAME_LEFT + column, FLAME_TOP + row, color);
		}
	}
	return t;
}

/** Warms every texel by the torch light at it, like the mock's shading: red most, blue least. */
function glow(t: Pixmap): void {
	for (let y = 0; y < SIZE; y++) {
		for (let x = 0; x < SIZE; x++) {
			const distance = Math.hypot(x + 0.5 - GLOW.x, y + 0.5 - GLOW.y, GLOW.depth);
			const falloff = 1 - distance / GLOW.reach;
			if (falloff <= 0) continue;
			const light = falloff * falloff;
			const color = t.pixels[y * SIZE + x] as number;
			const red = channel(((color >> 16) & 255) * (1 + light * 1.05) + light * 26);
			const green = channel(((color >> 8) & 255) * (1 + light * 0.55) + light * 9);
			const blue = channel((color & 255) * (1 + light * 0.15));
			t.pixels[y * SIZE + x] = (red << 16) | (green << 8) | blue;
		}
	}
}

function channel(value: number): number {
	return Math.min(255, Math.round(value));
}

/** The storage wall: two oak shelves on iron brackets, with books, a clay jar, scrolls, and a box. */
function shelf(): Pixmap {
	const t = stoneWall(53, false);
	plank(t, 27);
	plank(t, 53);
	// The top shelf: books, a leaning book, a jar, and two rolled scrolls.
	const spines = [c.SPINE_RED, c.SPINE_BLUE, c.SPINE_GREEN, c.OAK_DK, c.SPINE_RED];
	let x = 6;
	for (const [i, [width, height]] of (
		[
			[3, 14],
			[4, 17],
			[3, 12],
			[5, 15],
			[3, 13],
		] as const
	).entries()) {
		book(t, x, 26, width, height, spines[i] as number);
		x += width + 1;
	}
	for (let k = 0; k < 12; k++)
		fillRect(t, 30 + Math.floor(k / 3), 26 - k, 32 + Math.floor(k / 3), 26 - k, c.SPINE_BLUE);
	jar(t, 40, 26);
	scroll(t, 49, 24);
	scroll(t, 50, 21);
	// The bottom shelf: an iron-banded box, a stack of books lying flat, and a green bottle.
	fillRect(t, 6, 42, 21, 52, c.OAK);
	fillRect(t, 6, 42, 21, 42, c.OAK_DK);
	fillRect(t, 6, 46, 21, 47, c.IRON);
	plot(t, 13, 48, c.RIVET);
	fillRect(t, 13, 49, 14, 50, c.IRON);
	for (const [i, [x0, x1]] of (
		[
			[27, 41],
			[28, 40],
			[26, 39],
		] as const
	).entries()) {
		const y = 50 - i * 3;
		fillRect(t, x0, y, x1, y + 2, [c.SPINE_GREEN, c.SPINE_RED, c.OAK_DK][i] as number);
		fillRect(t, x1 - 1, y, x1, y + 2, c.PAPER_DK);
	}
	fillRect(t, 48, 44, 53, 52, c.SPINE_GREEN);
	fillRect(t, 50, 40, 51, 43, c.SPINE_GREEN);
	fillRect(t, 50, 39, 51, 39, c.OAK);
	plot(t, 49, 46, c.MOSS_HI);
	plot(t, 49, 47, c.MOSS_HI);
	return t;
}

/** An oak shelf plank with its top at `y`, a shadow under it, and an iron bracket under each end. */
function plank(t: Pixmap, y: number): void {
	for (let x = 3; x <= 60; x++) {
		if (colorAt(t, x, y + 3) !== c.MORTAR) plot(t, x, y + 3, c.STONE_LO);
	}
	fillRect(t, 3, y, 60, y + 2, c.OAK);
	fillRect(t, 3, y, 60, y, 0x6b4a2e);
	fillRect(t, 3, y + 2, 60, y + 2, c.OAK_DK);
	for (const bx of [8, 55]) {
		for (let k = 0; k < 4; k++) fillRect(t, bx - (3 - k), y + 3 + k, bx, y + 3 + k, c.IRON);
		plot(t, bx - 1, y + 4, c.RIVET);
	}
}

/** A standing book: a spine of `color` with its foot on `base`, and a paper band near the top. */
function book(t: Pixmap, x: number, base: number, width: number, height: number, color: number): void {
	fillRect(t, x, base - height + 1, x + width - 1, base, color);
	fillRect(t, x, base - height + 3, x + width - 1, base - height + 3, c.PAPER_DK);
	fillRect(t, x + width - 1, base - height + 1, x + width - 1, base, c.INK);
}

/** A clay jar with its foot on `base`, centered on `cx`. */
function jar(t: Pixmap, cx: number, base: number): void {
	const halfWidths = [2, 3, 4, 4, 4, 4, 4, 3, 2, 3];
	for (const [i, half] of halfWidths.entries()) {
		const y = base - i;
		fillRect(t, cx - half, y, cx + half, y, c.CLAY);
		plot(t, cx + half, y, c.CLAY_DK);
		plot(t, cx - half + 1, y, i > 1 && i < 7 ? 0x8c6c4e : c.CLAY);
	}
	fillRect(t, cx - 3, base - 10, cx + 3, base - 10, c.CLAY_DK);
}

/** A rolled scroll lying on its side, from x0 for 10 texels, with its top row at y: paper with ink ends. */
function scroll(t: Pixmap, x0: number, y: number): void {
	fillRect(t, x0, y, x0 + 9, y + 2, c.PAPER);
	fillRect(t, x0, y + 2, x0 + 9, y + 2, c.PAPER_DK);
	fillRect(t, x0, y, x0, y + 2, c.INK2);
	fillRect(t, x0 + 9, y, x0 + 9, y + 2, c.INK2);
	plot(t, x0 + 9, y + 1, c.INK);
}

/** The door: an iron-banded oak leaf under a stone lintel, with a ring pull, as in the mock. */
export function door(): Pixmap {
	const t = stoneWall(67, false);
	const random = seededRandom(71);
	const [x0, x1, y0] = [8, 55, 9];
	// The lintel: one long stone over the opening.
	fillRect(t, 3, 0, 60, 8, c.MORTAR);
	fillRect(t, 4, 1, 59, 7, c.STONE);
	fillRect(t, 4, 1, 59, 1, c.STONE_HI);
	fillRect(t, 4, 1, 4, 7, c.STONE_HI);
	fillRect(t, 5, 7, 59, 7, c.STONE_LO);
	fillRect(t, 59, 2, 59, 7, c.STONE_LO);
	fillRect(t, x0 - 1, y0 - 1, x1 + 1, LAST, c.MORTAR);
	// Planks: 8 texels wide, a gap on the left, a shaded right edge, and random grain.
	for (let x = x0; x <= x1; x++) {
		const p = (x - x0) % 8;
		fillRect(t, x, y0, x, LAST, p === 0 ? c.OAK_GAP : p === 7 ? c.OAK_DK : c.OAK);
	}
	for (let k = 0; k < 46; k++) {
		const gx = x0 + 1 + Math.floor(random() * (x1 - x0));
		if ((gx - x0) % 8 === 0) continue;
		const gy = y0 + Math.floor(random() * 50);
		const length = 3 + Math.floor(random() * 8);
		for (let j = 0; j < length && gy + j < LAST; j++) plot(t, gx, gy + j, c.OAK_DK);
	}
	// Iron bands with rivets.
	for (const by of [16, 47]) {
		fillRect(t, x0, by, x1, by + 3, c.IRON);
		for (let rx = x0 + 4; rx < x1; rx += 8) plot(t, rx, by + 1, c.RIVET);
	}
	// The ring pull on a small plate.
	fillRect(t, 43, 28, 46, 31, c.IRON);
	plot(t, 44, 29, c.RIVET);
	for (const [x, y] of [
		[44, 32],
		[45, 32],
		[43, 33],
		[46, 33],
		[42, 34],
		[47, 34],
		[42, 35],
		[47, 35],
		[43, 36],
		[46, 36],
		[44, 37],
		[45, 37],
	] as const) {
		plot(t, x, y, c.IRON);
	}
	plot(t, 43, 34, c.RIVET);
	fillRect(t, x0 - 1, LAST, x1 + 1, LAST, c.OAK_GAP);
	return t;
}

/**
 * The door track: the side walls of a door cell. A stone jamb with a deep groove in the middle,
 * edged with riveted iron strips, where the door slides.
 */
function doorTrack(): Pixmap {
	const t = stoneWall(83, false);
	fillRect(t, 25, 0, 38, LAST, c.GROOVE);
	fillRect(t, 25, 0, 27, LAST, c.IRON);
	fillRect(t, 36, 0, 38, LAST, c.IRON);
	fillRect(t, 25, 0, 25, LAST, c.IRON_HI);
	fillRect(t, 36, 0, 36, LAST, c.IRON_HI);
	fillRect(t, 24, 0, 24, LAST, c.MORTAR);
	fillRect(t, 39, 0, 39, LAST, c.STONE_LO);
	for (let y = 4; y < SIZE; y += 10) {
		plot(t, 26, y, c.RIVET);
		plot(t, 37, y, c.RIVET);
	}
	return t;
}
