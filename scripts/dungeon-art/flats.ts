/**
 * The Flats: the textures of the floor and the ceiling, 64x64, the texel size of the walls. A Flat
 * is not a texture role: one Flat covers exactly one tile and repeats on every tile, so each Flat
 * is seamless. Every row and column wraps at the tile edges, and the courses and the planks fill
 * the whole tile. The dungeon art set in `src/game/theme.ts` names these files as its floor Flat
 * and its ceiling Flat.
 */

import { createPixmap, fillRect, type Pixmap, plot, seededRandom } from "../art-kit/pixmap.ts";
import { type GeneratedFile, pngFile } from "./files.ts";
import * as c from "./palette.ts";
import { flagstones, SIZE } from "./stone.ts";

const WRAP = SIZE - 1;

/** Each Flat by file name. Add a Flat here, then name it in the art set. */
const FLATS: Readonly<Record<string, () => Pixmap>> = {
	flagstone: flagstoneFlat,
	timber: timberFlat,
};

export function flats(): GeneratedFile[] {
	return Object.entries(FLATS).map(([name, draw]) => pngFile(`textures/${name}.png`, draw()));
}

/** The floor Flat: big flagstones, laid with the cut stone of the walls. */
function flagstoneFlat(): Pixmap {
	return flagstones(97);
}

/** The planks run along x, each this many texels wide; the beam runs along y over them. */
const PLANK_WIDTH = 8;
const BEAM = { left: 24, right: 39 } as const;

/**
 * The ceiling Flat: oak planks with dark gaps, staggered butt joints, and grain, under one timber
 * beam with a lit edge, a shaded edge, grain, iron nails, and a shadow on the planks beside it.
 * One beam per tile gives a beam over every row of tiles.
 */
function timberFlat(): Pixmap {
	const t = createPixmap(SIZE, SIZE, c.PLANK);
	const random = seededRandom(107);
	for (let y0 = 0; y0 < SIZE; y0 += PLANK_WIDTH) {
		// The gap above the plank, the shaded row under it, and one butt joint at a random place.
		fillRect(t, 0, y0, WRAP, y0, c.PLANK_GAP);
		fillRect(t, 0, y0 + PLANK_WIDTH - 1, WRAP, y0 + PLANK_WIDTH - 1, c.PLANK_DK);
		const joint = Math.floor(random() * SIZE);
		fillRect(t, joint, y0 + 1, joint, y0 + PLANK_WIDTH - 1, c.PLANK_GAP);
		// Grain: short streaks along the plank, wrapped at the left and right edges.
		for (let k = 0; k < 5; k++) {
			const x = Math.floor(random() * SIZE);
			const y = y0 + 2 + Math.floor(random() * (PLANK_WIDTH - 3));
			const length = 4 + Math.floor(random() * 10);
			for (let i = 0; i < length; i++) {
				const gx = (x + i) & WRAP;
				if (gx !== joint) plot(t, gx, y, c.PLANK_DK);
			}
		}
	}
	// The shadow of the beam on the planks beside it.
	for (let y = 0; y < SIZE; y++) {
		for (const x of [BEAM.left - 1, BEAM.right + 1, BEAM.right + 2]) {
			if (t.pixels[y * SIZE + x] !== c.PLANK_GAP) plot(t, x, y, c.PLANK_DK);
		}
	}
	// The beam: a lit left edge, the body with grain along it, and a shaded right edge.
	fillRect(t, BEAM.left, 0, BEAM.right, WRAP, c.BEAM);
	fillRect(t, BEAM.left, 0, BEAM.left, WRAP, c.BEAM_HI);
	fillRect(t, BEAM.right - 1, 0, BEAM.right, WRAP, c.BEAM_LO);
	for (let k = 0; k < 10; k++) {
		const x = BEAM.left + 2 + Math.floor(random() * (BEAM.right - BEAM.left - 4));
		const y = Math.floor(random() * SIZE);
		const length = 6 + Math.floor(random() * 14);
		for (let i = 0; i < length; i++) plot(t, x, (y + i) & WRAP, c.BEAM_LO);
	}
	// Iron nails where the beam holds every other plank.
	for (let y = PLANK_WIDTH / 2; y < SIZE; y += PLANK_WIDTH * 2) {
		for (const x of [BEAM.left + 3, BEAM.right - 4]) {
			plot(t, x, y, c.IRON);
			plot(t, x, y - 1, c.IRON_HI);
		}
	}
	return t;
}
