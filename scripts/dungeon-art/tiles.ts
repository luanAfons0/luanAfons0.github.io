/**
 * The page tiles of the Dungeon look of the HTML surfaces: the pulp speck tile (the ground of
 * every page) and the cloth weave tile (the ground of the book cover). `src/theme.css` repeats
 * them, so the source has no gradient stripes. They port the pulp and the weave of the approved
 * mock (`.impeccable/mocks/ui-studio/parts/dungeon-screens.html`). Both tiles wrap at every edge.
 */

import { createPixmap, type Pixmap, seededRandom } from "../art-kit/pixmap.ts";
import { type GeneratedFile, pngFile } from "./files.ts";
import * as c from "./palette.ts";

/** The pulp tile size, as in the mock: large enough that the specks show no repeat. */
const PULP_SIZE = 160;
/** The weave tile size: a multiple of the thread pitch. */
const WEAVE_SIZE = 48;
/** One thread every 3 pixels in each direction, as in the mock. */
const PITCH = 3;

export function tiles(): GeneratedFile[] {
	return [pngFile("tiles/pulp.png", pulp()), pngFile("tiles/weave.png", weave())];
}

/**
 * Pulp paper: the page color with fine, sparse, one-pixel specks of fiber. As in the mock's
 * thresholded turbulence, about one pixel in ten gets a speck, most specks are faint, and none is
 * darker than `SPECK_MAX`.
 */
function pulp(): Pixmap {
	const t = createPixmap(PULP_SIZE, PULP_SIZE, c.PAPER);
	const random = seededRandom(101);
	for (let i = 0; i < t.pixels.length; i++) {
		const roll = random();
		if (roll < 1 - SPECK_SHARE) continue;
		const strength = (roll - (1 - SPECK_SHARE)) / SPECK_SHARE;
		t.pixels[i] = mix(c.PAPER, c.PULP_SPECK, SPECK_MAX * strength ** SPECK_CURVE);
	}
	return t;
}

/** The share of pulp pixels with a speck, and the strength of the darkest speck (0 to 1). */
const SPECK_SHARE = 0.112;
const SPECK_MAX = 0.64;
/** Above 1, most specks are faint. */
const SPECK_CURVE = 2.6;

/**
 * Cloth weave: the cover green crossed by darker threads, one row and one column in every three.
 * The cross threads (rows) lie on top and are darker, as in the mock. Each thread has its own
 * strength, so the cloth looks woven, not ruled.
 */
function weave(): Pixmap {
	const t = createPixmap(WEAVE_SIZE, WEAVE_SIZE, c.COVER);
	const random = seededRandom(107);
	const threads = WEAVE_SIZE / PITCH;
	const rows = Array.from({ length: threads }, () => 0.35 * (0.8 + 0.4 * random()));
	const columns = Array.from({ length: threads }, () => 0.25 * (0.8 + 0.4 * random()));
	for (let y = 0; y < WEAVE_SIZE; y++) {
		for (let x = 0; x < WEAVE_SIZE; x++) {
			let color = c.COVER;
			if (x % PITCH === PITCH - 1) color = mix(color, c.COVER_INK, columns[Math.floor(x / PITCH)] as number);
			if (y % PITCH === PITCH - 1) color = mix(color, c.COVER_INK, rows[Math.floor(y / PITCH)] as number);
			t.pixels[y * WEAVE_SIZE + x] = color;
		}
	}
	return t;
}

/** `ground` with `ink` laid over it at `alpha` (0 to 1), as 0xRRGGBB. */
function mix(ground: number, ink: number, alpha: number): number {
	let color = 0;
	for (const shift of [16, 8, 0]) {
		const [g, i] = [(ground >> shift) & 255, (ink >> shift) & 255];
		color |= Math.round(g + (i - g) * alpha) << shift;
	}
	return color;
}
