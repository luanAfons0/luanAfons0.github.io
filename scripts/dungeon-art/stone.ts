/**
 * Cut stone, the ground of every dungeon wall: courses of blocks in mortar, as in the approved
 * mock's game frame. The textures and the banner posters draw on it, and the floor Flat lays the
 * same blocks as flagstones.
 */
import { createPixmap, type Pixmap, plot, seededRandom } from "../art-kit/pixmap.ts";
import * as c from "./palette.ts";

/** Wall textures are 64x64, one tile high. Stone wraps at the left and right edges. */
export const SIZE = 64;
const WRAP = SIZE - 1;

/** The colors of one kind of cut stone: the block tones, the lit and shaded edges, the specks, and the joints. */
interface StoneColors {
	tones: readonly [number, number, number];
	hi: number;
	lo: number;
	speckHi: number;
	speckLo: number;
	mortar: number;
}

/** The grey stone of the walls. */
const WALL_STONE: StoneColors = {
	tones: [c.STONE, c.STONE_A, c.STONE_B],
	hi: c.STONE_HI,
	lo: c.STONE_LO,
	speckHi: c.SPECK_HI,
	speckLo: c.SPECK_LO,
	mortar: c.MORTAR,
};

/** The flagstones of the floor: darker and warmer than the walls, with deep seams. */
const FLAGSTONE: StoneColors = {
	tones: [c.FLAG, c.FLAG_A, c.FLAG_B],
	hi: c.FLAG_HI,
	lo: c.FLAG_LO,
	speckHi: c.FLAG_SPECK_HI,
	speckLo: c.FLAG_SPECK_LO,
	mortar: c.SEAM,
};

/**
 * How a stone surface lays its blocks: the height of each course from the top, the block widths
 * (from `minWidth` to `minWidth + widthSpread - 1`; the last block of a course grows rather than
 * leave a gap under `minWidth`), and whether the blocks are rough (uneven edges, more specks).
 */
interface CoursePlan {
	heights: readonly number[];
	minWidth: number;
	widthSpread: number;
	rough: boolean;
}

/** The courses of a wall of even blocks. The bottom row stays mortar. */
const WALL_COURSES: CoursePlan = { heights: [16, 16, 16, 15], minWidth: 14, widthSpread: 13, rough: false };

/** The courses of a rough wall: smaller, uneven blocks. The bottom row stays mortar. */
const ROUGH_WALL_COURSES: CoursePlan = { heights: [14, 17, 15, 17], minWidth: 10, widthSpread: 15, rough: true };

/** The courses of the floor: three courses of big flagstones that fill the whole height. */
const FLAGSTONE_COURSES: CoursePlan = { heights: [22, 20, 22], minWidth: 18, widthSpread: 15, rough: false };

/**
 * A 64x64 stone wall. Rough stone has smaller, uneven blocks with more chips and cracks. Each
 * course of blocks starts at a random offset; the bottom row stays mortar.
 */
export function stoneWall(seed: number, rough: boolean): Pixmap {
	const t = createPixmap(SIZE, SIZE, c.MORTAR);
	const random = seededRandom(seed);
	layCourses(t, random, WALL_STONE, rough ? ROUGH_WALL_COURSES : WALL_COURSES);
	chips(t, random, WALL_STONE, rough ? 8 : 3);
	cracks(t, random, WALL_STONE, rough ? 3 : 1, rough ? 10 : 6);
	return t;
}

/**
 * The floor of a tile: three courses of big flagstones. The courses fill the whole height and each
 * one wraps at the left and right edges, so the flagstones tile with no seam, one tile each.
 */
export function flagstones(seed: number): Pixmap {
	const t = createPixmap(SIZE, SIZE, FLAGSTONE.mortar);
	const random = seededRandom(seed);
	layCourses(t, random, FLAGSTONE, FLAGSTONE_COURSES);
	chips(t, random, FLAGSTONE, 4);
	// A crack starts at row 51 at most and runs 8 rows at most, so it never crosses the bottom edge.
	cracks(t, random, FLAGSTONE, 2, 8);
	return t;
}

/** Lays the courses of a plan from the top, each from a random offset. */
function layCourses(t: Pixmap, random: () => number, colors: StoneColors, plan: CoursePlan): void {
	const { heights, minWidth, widthSpread, rough } = plan;
	let y0 = 0;
	for (const height of heights) {
		const offset = Math.floor(random() * SIZE);
		let done = 0;
		while (done < SIZE) {
			let blockWidth = minWidth + Math.floor(random() * widthSpread);
			if (SIZE - done - blockWidth < minWidth) blockWidth = SIZE - done;
			const tone = colors.tones[Math.floor(random() * 3)] as number;
			block(t, random, colors, offset + done, y0, blockWidth, height, tone, rough);
			done += blockWidth;
		}
		y0 += height;
	}
}

/** The color at (x, y), or undefined outside the pixmap. */
export function colorAt(t: Pixmap, x: number, y: number): number | undefined {
	if (x < 0 || y < 0 || x >= t.width || y >= t.height) return undefined;
	return t.pixels[y * t.width + x];
}

/** One block: mortar on its left column and top row, lit top and left edges, shaded bottom and right. */
function block(
	t: Pixmap,
	random: () => number,
	colors: StoneColors,
	x0: number,
	y0: number,
	width: number,
	height: number,
	tone: number,
	rough: boolean,
): void {
	for (let y = y0 + 1; y < y0 + height; y++) {
		for (let i = 1; i < width; i++) {
			const x = (x0 + i) & WRAP;
			const r = random();
			let color = tone;
			if (y === y0 + 1 || i === 1) color = rough && r < 0.3 ? tone : colors.hi;
			else if (y === y0 + height - 1 || i === width - 1) color = rough && r < 0.2 ? tone : colors.lo;
			else if (r < (rough ? 0.16 : 0.08)) color = r < (rough ? 0.08 : 0.04) ? colors.speckLo : colors.speckHi;
			plot(t, x, y, color);
		}
	}
}

/** Chips: a dark notch with a lit lower lip. */
function chips(t: Pixmap, random: () => number, colors: StoneColors, count: number): void {
	for (let k = 0; k < count; k++) {
		const x = Math.floor(random() * 62);
		const y = 2 + Math.floor(random() * 58);
		if (colorAt(t, x, y) === colors.mortar) continue;
		plot(t, x, y, colors.mortar);
		plot(t, x + 1, y, colors.lo);
		plot(t, x, y + 1, colors.lo);
		plot(t, x + 1, y + 1, colors.hi);
	}
}

/** Cracks: short downward random walks in mortar color. */
function cracks(t: Pixmap, random: () => number, colors: StoneColors, count: number, length: number): void {
	for (let k = 0; k < count; k++) {
		let x = Math.floor(random() * SIZE);
		let y = 2 + Math.floor(random() * 50);
		const steps = Math.floor(length / 2 + (random() * length) / 2);
		for (let s = 0; s < steps; s++) {
			plot(t, x & WRAP, y, colors.mortar);
			y++;
			x += Math.floor(random() * 3) - 1;
		}
	}
}

/** Moss: a noisy patch around (cx, cy) that creeps further along the mortar lines. */
export function moss(t: Pixmap, random: () => number, cx: number, cy: number, radius: number): void {
	for (let y = Math.round(cy - radius * 1.5); y <= cy + radius * 1.5; y++) {
		if (y < 0 || y >= SIZE) continue;
		for (let x = Math.round(cx - radius * 1.6); x <= cx + radius * 1.6; x++) {
			const wrapped = x & WRAP;
			const dx = x - cx;
			const dy = (y - cy) * 1.3;
			const distance = Math.sqrt(dx * dx + dy * dy);
			const grows =
				colorAt(t, wrapped, y) === c.MORTAR
					? distance < radius * 1.5 && random() < 0.8
					: distance < radius * (0.6 + 0.5 * random());
			if (!grows) continue;
			const q = random();
			plot(t, wrapped, y, q < 0.2 ? c.MOSS_HI : q < 0.45 ? c.MOSS_DK : c.MOSS);
		}
	}
}
