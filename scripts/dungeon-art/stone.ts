/**
 * Cut stone, the ground of every dungeon wall: courses of blocks in mortar, as in the approved
 * mock's game frame. The textures and the banner posters draw on it.
 */
import { createPixmap, type Pixmap, plot, seededRandom } from "../art-kit/pixmap.ts";
import * as c from "./palette.ts";

/** Wall textures are 64x64, one tile high. Stone wraps at the left and right edges. */
export const SIZE = 64;
const WRAP = SIZE - 1;

/**
 * A 64x64 stone wall. Rough stone has smaller, uneven blocks with more chips and cracks. Each
 * course of blocks starts at a random offset; the bottom row stays mortar.
 */
export function stoneWall(seed: number, rough: boolean): Pixmap {
	const t = createPixmap(SIZE, SIZE, c.MORTAR);
	const random = seededRandom(seed);
	const courses = rough ? [14, 17, 15, 17] : [16, 16, 16, 15];
	const tones = [c.STONE, c.STONE_A, c.STONE_B];
	const minWidth = rough ? 10 : 14;
	let y0 = 0;
	for (const height of courses) {
		const offset = Math.floor(random() * SIZE);
		let done = 0;
		while (done < SIZE) {
			let width = rough ? 10 + Math.floor(random() * 15) : 14 + Math.floor(random() * 13);
			if (SIZE - done - width < minWidth) width = SIZE - done;
			block(t, random, offset + done, y0, width, height, tones[Math.floor(random() * 3)] as number, rough);
			done += width;
		}
		y0 += height;
	}
	chips(t, random, rough ? 8 : 3);
	cracks(t, random, rough ? 3 : 1, rough ? 10 : 6);
	return t;
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
			if (y === y0 + 1 || i === 1) color = rough && r < 0.3 ? tone : c.STONE_HI;
			else if (y === y0 + height - 1 || i === width - 1) color = rough && r < 0.2 ? tone : c.STONE_LO;
			else if (r < (rough ? 0.16 : 0.08)) color = r < (rough ? 0.08 : 0.04) ? c.SPECK_LO : c.SPECK_HI;
			plot(t, x, y, color);
		}
	}
}

/** Chips: a dark notch with a lit lower lip. */
function chips(t: Pixmap, random: () => number, count: number): void {
	for (let k = 0; k < count; k++) {
		const x = Math.floor(random() * 62);
		const y = 2 + Math.floor(random() * 58);
		if (colorAt(t, x, y) === c.MORTAR) continue;
		plot(t, x, y, c.MORTAR);
		plot(t, x + 1, y, c.STONE_LO);
		plot(t, x, y + 1, c.STONE_LO);
		plot(t, x + 1, y + 1, c.STONE_HI);
	}
}

/** Cracks: short downward random walks in mortar color. */
function cracks(t: Pixmap, random: () => number, count: number, length: number): void {
	for (let k = 0; k < count; k++) {
		let x = Math.floor(random() * SIZE);
		let y = 2 + Math.floor(random() * 50);
		const steps = Math.floor(length / 2 + (random() * length) / 2);
		for (let s = 0; s < steps; s++) {
			plot(t, x & WRAP, y, c.MORTAR);
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
