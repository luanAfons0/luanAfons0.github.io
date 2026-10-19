/**
 * The Flats: the textures of the floor and the ceiling, 64x64, the texel size of the walls. A Flat
 * is not a texture role: one Flat covers exactly one tile and repeats on every tile, so each Flat
 * is seamless. A trace that leaves one edge enters at the matching point of the opposite edge, the
 * speck noise is random per pixel, and the panel grid draws one seam per period. The machine art
 * set in `src/game/theme.ts` names these files as its floor Flat and its ceiling Flat.
 */

import {
	createPixmap,
	disc,
	fillRect,
	outlineRect,
	type Pixmap,
	type Point,
	path,
	plot,
	seededRandom,
} from "../art-kit/pixmap.ts";
import { type GeneratedFile, pngFile } from "./files.ts";
import * as c from "./palette.ts";
import { solderMask, via } from "./textures.ts";

const SIZE = 64;

/** Each Flat by file name. Add a Flat here, then name it in the art set. */
const FLATS: Readonly<Record<string, () => Pixmap>> = {
	"solder-mask": solderMaskFlat,
	"heat-sink": heatSinkFlat,
};

export function flats(): GeneratedFile[] {
	return Object.entries(FLATS).map(([name, draw]) => pngFile(`textures/${name}.png`, draw()));
}

/**
 * Draws a shape at the tile and at its eight neighbor copies. Every drawing call clips to the
 * pixmap, so a shape that crosses one edge comes back in at the opposite edge.
 */
function wrapped(draw: (dx: number, dy: number) => void): void {
	for (const dy of [-SIZE, 0, SIZE]) for (const dx of [-SIZE, 0, SIZE]) draw(dx, dy);
}

/** A path that wraps at the edges. A wide path is two pixels thick. */
function wrappedPath(pixmap: Pixmap, points: readonly Point[], color: number, wide = false): void {
	wrapped((dx, dy) => {
		const moved = points.map(([x, y]) => [x + dx, y + dy] as const);
		path(pixmap, moved, color, wide);
	});
}

/** A via of the walls that wraps at the edges. */
function wrappedVia(pixmap: Pixmap, x: number, y: number): void {
	wrapped((dx, dy) => via(pixmap, x + dx, y + dy));
}

/** A small stitching via, for via fields. */
function smallVia(pixmap: Pixmap, x: number, y: number): void {
	disc(pixmap, x, y, 1, c.RING);
	plot(pixmap, x, y, c.HOLE);
}

/** Two tinned pads of an empty two-pin footprint, with a silkscreen outline. */
function padPair(pixmap: Pixmap, x: number, y: number): void {
	outlineRect(pixmap, x - 1, y - 1, x + 7, y + 3, c.SILK);
	fillRect(pixmap, x, y, x + 1, y + 2, c.SILVER_DK);
	fillRect(pixmap, x + 5, y, x + 6, y + 2, c.SILVER_DK);
}

/**
 * The floor Flat: matte solder mask with wide copper traces, ring vias, a stitching via field,
 * and two empty footprints. The floor is seen from a low angle and gets darker with distance, so
 * the traces are two pixels wide, as on the walls.
 */
function solderMaskFlat(): Pixmap {
	const t = solderMask(101);
	// The bus crosses the tile from left to right and the trunk from top to bottom; they meet at a via.
	const traces: readonly (readonly Point[])[] = [
		[
			[0, 10],
			[18, 10],
			[24, 16],
			[42, 16],
			[48, 10],
			[64, 10],
		],
		[
			[53, 0],
			[53, 26],
			[47, 32],
			[47, 49],
			[53, 55],
			[53, 64],
		],
		// A pair of traces that leaves the right edge and enters again at the left edge.
		[
			[56, 39],
			[59, 36],
			[74, 36],
			[80, 42],
			[92, 42],
		],
		[
			[56, 43],
			[60, 39],
			[73, 39],
			[79, 45],
			[92, 45],
		],
		// A trace that leaves the bottom edge and enters again at the top edge.
		[
			[31, 23],
			[31, 58],
			[35, 62],
			[35, 70],
		],
		[
			[9, 19],
			[9, 27],
			[15, 33],
		],
	];
	for (const points of traces) wrappedPath(t, points, c.TRACE, true);
	for (const [x, y] of [
		[53, 10],
		[56, 39],
		[56, 43],
		[28, 42],
		[28, 45],
		[31, 23],
		[35, 6],
		[9, 19],
		[15, 33],
	] as const) {
		wrappedVia(t, x, y);
	}
	for (let y = 51; y <= 59; y += 4) for (let x = 6; x <= 22; x += 4) smallVia(t, x, y);
	padPair(t, 36, 24);
	padPair(t, 34, 48);
	return t;
}

/**
 * The ceiling Flat: a grid of four heat-sink panels. Each panel has fins with a lit edge and a
 * shadow, turned a quarter turn from its neighbors, and a screw head in each corner. The panels
 * are darker and cooler than the floor, so the ceiling reads as above.
 */
function heatSinkFlat(): Pixmap {
	const PANEL = SIZE / 2;
	const t = createPixmap(SIZE, SIZE);
	const random = seededRandom(131);
	for (let i = 0; i < t.pixels.length; i++) t.pixels[i] = random() < 0.12 ? c.PANEL_HI : c.PANEL;
	for (let row = 0; row < 2; row++) {
		for (let column = 0; column < 2; column++) {
			const x0 = column * PANEL;
			const y0 = row * PANEL;
			const across = (row + column) % 2 === 0;
			// The fins, in the middle of the panel: a lit edge, the fin, and its shadow.
			for (let fin = 6; fin < PANEL - 7; fin += 4) {
				if (across) {
					fillRect(t, x0 + 6, y0 + fin, x0 + PANEL - 7, y0 + fin, c.PANEL_EDGE);
					fillRect(t, x0 + 6, y0 + fin + 1, x0 + PANEL - 7, y0 + fin + 1, c.PANEL_HI);
					fillRect(t, x0 + 6, y0 + fin + 2, x0 + PANEL - 7, y0 + fin + 2, c.PANEL_INNER);
				} else {
					fillRect(t, x0 + fin, y0 + 6, x0 + fin, y0 + PANEL - 7, c.PANEL_EDGE);
					fillRect(t, x0 + fin + 1, y0 + 6, x0 + fin + 1, y0 + PANEL - 7, c.PANEL_HI);
					fillRect(t, x0 + fin + 2, y0 + 6, x0 + fin + 2, y0 + PANEL - 7, c.PANEL_INNER);
				}
			}
			// The screw heads.
			for (const [x, y] of [
				[x0 + 3, y0 + 3],
				[x0 + PANEL - 4, y0 + 3],
				[x0 + 3, y0 + PANEL - 4],
				[x0 + PANEL - 4, y0 + PANEL - 4],
			] as const) {
				disc(t, x, y, 1, c.SCREW);
				plot(t, x, y, c.SCREW_SLOT);
			}
		}
	}
	// One seam per period: a lit pixel on the first column (or row) of each panel and a dark gap
	// on its last, so the seam at the tile edges is as wide as the seam in the middle.
	for (let at = 0; at < SIZE; at += PANEL) {
		fillRect(t, at, 0, at, SIZE - 1, c.PANEL_EDGE);
		fillRect(t, 0, at, SIZE - 1, at, c.PANEL_EDGE);
		fillRect(t, at + PANEL - 1, 0, at + PANEL - 1, SIZE - 1, c.SLOT);
		fillRect(t, 0, at + PANEL - 1, SIZE - 1, at + PANEL - 1, c.SLOT);
	}
	return t;
}
