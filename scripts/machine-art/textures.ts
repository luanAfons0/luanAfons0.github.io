/**
 * The wall textures: 64x64, one tile high. The Level tileset names them by file name, and the
 * art set in `src/game/theme.ts` lists the same names.
 */
import { type GeneratedFile, pngFile } from "./files.ts";
import * as c from "./palette.ts";
import { createPixmap, disc, fillRect, outlineRect, type Pixmap, path, plot, seededRandom, text } from "./pixmap.ts";

const SIZE = 64;
const LAST = SIZE - 1;

/** Each texture by name. Add a texture here, then add its name to the art set. */
const TEXTURES: Readonly<Record<string, () => Pixmap>> = {
	"board-a": boardA,
	"board-b": boardB,
	chip,
	rack,
	door,
	"door-track": doorTrack,
};

export function textures(): GeneratedFile[] {
	return Object.entries(TEXTURES).map(([name, draw]) => pngFile(`textures/${name}.png`, draw()));
}

/** Matte solder mask: the base color with sparse light and dark specks. */
function solderMask(seed: number): Pixmap {
	const pixmap = createPixmap(SIZE, SIZE);
	const random = seededRandom(seed);
	for (let i = 0; i < pixmap.pixels.length; i++) {
		const r = random();
		pixmap.pixels[i] = r < 0.14 ? c.MASK_HI : r < 0.24 ? c.MASK_LO : c.MASK;
	}
	return pixmap;
}

/** A thin board edge at the top and the bottom, so walls stand apart from the floor and the ceiling. */
function boardEdges(pixmap: Pixmap): void {
	fillRect(pixmap, 0, 0, LAST, 0, c.TRACE);
	fillRect(pixmap, 0, LAST, LAST, LAST, c.RING);
}

function via(pixmap: Pixmap, x: number, y: number): void {
	disc(pixmap, x, y, 2, c.RING);
	plot(pixmap, x, y, c.HOLE);
}

/** Board with traces, vias, a resistor footprint (R12), and a capacitor outline (C4). */
function boardA(): Pixmap {
	const t = solderMask(11);
	path(
		t,
		[
			[0, 12],
			[18, 12],
			[26, 20],
			[26, 34],
			[34, 42],
			[63, 42],
		],
		c.TRACE,
		true,
	);
	path(
		t,
		[
			[40, 0],
			[40, 9],
			[48, 17],
			[63, 17],
		],
		c.TRACE,
	);
	path(
		t,
		[
			[0, 52],
			[12, 52],
			[20, 44],
		],
		c.TRACE,
	);
	path(
		t,
		[
			[50, 63],
			[50, 55],
			[56, 49],
		],
		c.TRACE,
	);
	path(
		t,
		[
			[8, 63],
			[8, 58],
			[14, 58],
		],
		c.TRACE,
	);
	via(t, 20, 44);
	via(t, 56, 49);
	via(t, 14, 58);
	via(t, 10, 22);
	outlineRect(t, 36, 25, 55, 33, c.SILK);
	fillRect(t, 38, 27, 40, 31, c.SILVER_DK);
	fillRect(t, 51, 27, 53, 31, c.SILVER_DK);
	text(t, "R12", 37, 17, c.SILK);
	outlineRect(t, 4, 28, 12, 36, c.SILK);
	plot(t, 8, 30, c.SILK);
	fillRect(t, 7, 31, 9, 31, c.SILK);
	text(t, "C4", 3, 39, c.SILK);
	boardEdges(t);
	return t;
}

/** Board with other traces, a small SOIC footprint, and the label U3. */
function boardB(): Pixmap {
	const t = solderMask(23);
	path(
		t,
		[
			[0, 30],
			[14, 30],
			[22, 22],
			[22, 4],
			[30, 4],
			[30, 0],
		],
		c.TRACE,
	);
	path(
		t,
		[
			[0, 34],
			[16, 34],
			[24, 26],
			[44, 26],
			[52, 34],
			[63, 34],
		],
		c.TRACE,
		true,
	);
	path(
		t,
		[
			[63, 8],
			[52, 8],
			[46, 14],
		],
		c.TRACE,
	);
	path(
		t,
		[
			[34, 63],
			[34, 52],
			[40, 46],
			[58, 46],
		],
		c.TRACE,
	);
	via(t, 46, 14);
	via(t, 58, 46);
	via(t, 6, 50);
	via(t, 12, 50);
	outlineRect(t, 40, 52, 60, 61, c.SILK);
	plot(t, 42, 54, c.SILK);
	for (let x = 44; x <= 57; x += 4) {
		fillRect(t, x, 50, x + 1, 51, c.SILVER_DK);
		fillRect(t, x, 62, x + 1, 62, c.SILVER_DK);
	}
	text(t, "U3", 6, 6, c.SILK);
	outlineRect(t, 4, 15, 18, 21, c.SILK);
	boardEdges(t);
	return t;
}

/** A square IC with silver pins on all four sides and a faint laser-etched marking. */
function chip(): Pixmap {
	const t = solderMask(37);
	fillRect(t, 13, 13, 50, 50, c.EPOXY);
	fillRect(t, 13, 13, 50, 13, c.EPOXY_LIT);
	fillRect(t, 13, 13, 13, 50, c.EPOXY_LIT);
	fillRect(t, 13, 50, 50, 50, c.EPOXY_SHADOW);
	fillRect(t, 50, 13, 50, 50, c.EPOXY_SHADOW);
	for (let p = 16; p <= 46; p += 4) {
		fillRect(t, p, 8, p + 1, 12, c.SILVER);
		fillRect(t, p, 8, p + 1, 8, c.SILVER_DK);
		fillRect(t, p, 51, p + 1, 55, c.SILVER);
		fillRect(t, p, 55, p + 1, 55, c.SILVER_DK);
		fillRect(t, 8, p, 12, p + 1, c.SILVER);
		fillRect(t, 8, p, 8, p + 1, c.SILVER_DK);
		fillRect(t, 51, p, 55, p + 1, c.SILVER);
		fillRect(t, 55, p, 55, p + 1, c.SILVER_DK);
	}
	disc(t, 18, 18, 2, 0x24282c);
	text(t, "MCU", 24, 26, 0x3a3f43);
	text(t, "2026", 21, 36, 0x30353a);
	// The pin 1 corner mark in silkscreen.
	fillRect(t, 3, 3, 5, 3, c.SILK);
	fillRect(t, 3, 3, 3, 5, c.SILK);
	boardEdges(t);
	return t;
}

/** A server-rack panel: five slots with vents and two LEDs each; two LEDs are lit copper. */
function rack(): Pixmap {
	const t = createPixmap(SIZE, SIZE);
	const random = seededRandom(51);
	for (let i = 0; i < t.pixels.length; i++) t.pixels[i] = random() < 0.12 ? c.PANEL_HI : c.PANEL;
	outlineRect(t, 0, 0, LAST, LAST, c.PANEL_EDGE);
	outlineRect(t, 1, 1, LAST - 1, LAST - 1, c.PANEL_INNER);
	for (const [x, y] of [
		[4, 4],
		[59, 4],
		[4, 59],
		[59, 59],
	] as const) {
		disc(t, x, y, 2, c.SCREW);
		fillRect(t, x - 1, y, x + 1, y, c.SCREW_SLOT);
	}
	/** The lit LEDs, as slot and LED index. */
	const lit = new Set(["0:0", "2:1"]);
	for (let slot = 0; slot < 5; slot++) {
		const y = 10 + slot * 9;
		fillRect(t, 8, y, 45, y + 5, c.SLOT);
		fillRect(t, 8, y, 45, y, c.SLOT_LIP);
		fillRect(t, 8, y + 6, 45, y + 6, c.RING);
		for (let x = 11; x < 44; x += 4) fillRect(t, x, y + 2, x + 1, y + 3, c.VENT);
		for (let led = 0; led < 2; led++) {
			const x = 50 + led * 5;
			fillRect(t, x, y + 2, x + 1, y + 3, lit.has(`${slot}:${led}`) ? c.COPPER_LIT : c.LED_DIM);
		}
	}
	return t;
}

/**
 * The door: a board section in a silkscreen frame, with an up arrow and silver connector fingers
 * along the bottom edge, so it reads as a door. Its label P1 is a plug, not a Part label.
 */
function door(): Pixmap {
	const t = solderMask(67);
	path(
		t,
		[
			[0, 20],
			[10, 20],
			[16, 26],
			[16, 46],
		],
		c.TRACE,
	);
	path(
		t,
		[
			[63, 14],
			[52, 14],
			[46, 20],
			[46, 46],
		],
		c.TRACE,
	);
	outlineRect(t, 4, 3, 59, 49, c.SILK);
	fillRect(t, 30, 18, 33, 38, c.SILK);
	for (let row = 0; row < 8; row++) fillRect(t, 31 - row, 10 + row, 32 + row, 10 + row, c.SILK);
	text(t, "P1", 8, 7, c.SILK);
	fillRect(t, 0, 52, LAST, LAST, c.EDGE);
	for (let x = 4; x < 60; x += 5) {
		fillRect(t, x, 54, x + 2, LAST, c.SILVER);
		fillRect(t, x, 54, x + 2, 54, c.SILVER_DK);
	}
	return t;
}

/**
 * The door track: the side walls of a door cell. A connector socket seen from the side: a dark
 * slot between two silver guide rails, with latch notches, so the doorway frames the door.
 */
function doorTrack(): Pixmap {
	const t = solderMask(83);
	fillRect(t, 22, 0, 41, LAST, c.EDGE);
	fillRect(t, 22, 0, 23, LAST, c.SILVER_DK);
	fillRect(t, 40, 0, 41, LAST, c.SILVER_DK);
	fillRect(t, 24, 0, 24, LAST, c.SILVER);
	fillRect(t, 39, 0, 39, LAST, c.SILVER);
	for (let y = 6; y < SIZE; y += 12) {
		fillRect(t, 26, y, 37, y + 1, c.TRACE);
		via(t, 11, y + 2);
		via(t, 52, y + 2);
	}
	boardEdges(t);
	return t;
}
