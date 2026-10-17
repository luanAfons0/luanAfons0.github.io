/**
 * The Bug frames: a small, friendly green Slime, 32x24, ported from the approved mock's game frame.
 * Two walk frames squash and stretch it. The fix frames flash it white, break it into drops, and
 * fade the drops into an ink tick box on pulp paper; the "cleared" mark is that box, ticked with an
 * ink cross like the tick boxes of the HUD. The art set in `src/game/theme.ts` lists the same frame names.
 *
 * Sprite PNGs have no place for the anchor, so this module also writes `sprites/offsets.json`.
 */

import { bugFrameFiles } from "../art-kit/kinds.ts";
import { createPixmap, disc, fillRect, flash, type Pixmap, plot, TRANSPARENT } from "../art-kit/pixmap.ts";
import { type GeneratedFile, pngFile } from "./files.ts";
import * as c from "./palette.ts";

const WIDTH = 32;
const HEIGHT = 24;

/**
 * The anchor of every frame: the middle of the frame, 14 texels above its bottom row. The Game
 * core puts the anchor 0.2 tiles above the floor and draws 72 texels per tile, so the Slime sits
 * on the floor.
 */
const ANCHOR = { left: WIDTH / 2, top: HEIGHT - 14 };

/**
 * Each frame by name. The art set plays the fix frames in this order and lists `slime-cleared`
 * three times, so the mark stays for half of the fix sequence.
 */
const FRAMES: Readonly<Record<string, () => Pixmap>> = {
	"slime-walk-1": () => slime(false),
	"slime-walk-2": () => slime(true),
	"slime-fix-1": () => flash(slime(false), c.EYE),
	"slime-fix-2": () => drops(),
	"slime-fix-3": () => tickBox(fade(drops())),
	"slime-cleared": () => cross(tickBox(createPixmap(WIDTH, HEIGHT))),
};

export function bugs(): GeneratedFile[] {
	return bugFrameFiles(pngFile, FRAMES, ANCHOR);
}

/**
 * The Slime: a dome on a flat, rounded foot, with a rim, light from the top left, two eyes that
 * look a little down, a small smile, and a shine spot. Squashed, it is wider and lower.
 */
export function slime(squashed: boolean): Pixmap {
	const t = createPixmap(WIDTH, HEIGHT);
	const halfWidth = squashed ? 14.5 : 12.5;
	const height = squashed ? 16 : 20;
	const cx = 15.5;
	const base = HEIGHT;
	const cy = base - height * 0.42;
	const inside = (x: number, y: number): boolean => {
		if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return false;
		const nx = (x + 0.5 - cx) / halfWidth;
		const dy = y + 0.5 - cy;
		if (dy < 0) {
			const ny = dy / (height * 0.58);
			return nx * nx + ny * ny <= 1;
		}
		const ny = dy / (height * 0.42 + 0.5);
		return nx ** 4 + ny ** 4 <= 1;
	};
	for (let y = 0; y < HEIGHT; y++) {
		for (let x = 0; x < WIDTH; x++) {
			if (!inside(x, y)) continue;
			let color = c.SLIME;
			if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) color = c.SLIME_RIM;
			else if (!inside(x - 1, y - 2)) color = c.SLIME_HI;
			else if (!inside(x + 2, y + 2)) color = c.SLIME_SH;
			plot(t, x, y, color);
		}
	}
	const eyeTop = Math.round(base - height * 0.62);
	for (const eyeLeft of [Math.round(cx - 5.5), Math.round(cx + 2.5)]) {
		fillRect(t, eyeLeft, eyeTop, eyeLeft + 2, eyeTop + 3, c.EYE);
		fillRect(t, eyeLeft + 1, eyeTop + 2, eyeLeft + 2, eyeTop + 3, c.INK);
	}
	const mouthY = eyeTop + 6;
	const mouthX = Math.round(cx) - 2;
	plot(t, mouthX, mouthY, c.SLIME_RIM);
	plot(t, mouthX + 1, mouthY + 1, c.SLIME_RIM);
	plot(t, mouthX + 2, mouthY + 1, c.SLIME_RIM);
	plot(t, mouthX + 3, mouthY, c.SLIME_RIM);
	const shineX = Math.round(cx - halfWidth * 0.55);
	const shineY = Math.round(base - height * 0.8);
	plot(t, shineX, shineY, c.SHINE);
	plot(t, shineX + 1, shineY, c.SHINE);
	plot(t, shineX, shineY + 1, c.SHINE);
	return t;
}

/** The drops the Slime breaks into, as x, y, and radius, over a low puddle where it sat. */
const DROPS: readonly (readonly [number, number, number])[] = [
	[8, 8, 2],
	[23, 6, 2],
	[15, 3, 1],
	[3, 14, 1],
	[28, 13, 1],
	[10, 15, 2],
	[21, 14, 2],
];

/** The Slime broken into drops: rimmed green discs with a light spot, and a puddle on the floor. */
function drops(): Pixmap {
	const t = createPixmap(WIDTH, HEIGHT);
	for (let y = 21; y < HEIGHT; y++) {
		const half = y === 21 ? 7 : 10;
		fillRect(t, 16 - half, y, 15 + half, y, y === 21 ? c.SLIME_RIM : c.SLIME);
	}
	plot(t, 6, 22, c.SLIME_RIM);
	plot(t, 25, 22, c.SLIME_RIM);
	for (const [x, y, radius] of DROPS) {
		disc(t, x, y, radius, c.SLIME_RIM);
		if (radius > 1) disc(t, x, y, radius - 1, c.SLIME);
		plot(t, x - (radius > 1 ? 1 : 0), y - (radius > 1 ? 1 : 0), c.SLIME_HI);
	}
	return t;
}

/** Keeps one pixel in four, in a regular grid, so the drops break up. */
function fade(t: Pixmap): Pixmap {
	for (let y = 0; y < HEIGHT; y++) {
		for (let x = 0; x < WIDTH; x++) {
			if (x % 2 !== 0 || y % 2 !== 0) t.pixels[y * WIDTH + x] = TRANSPARENT;
		}
	}
	return t;
}

/** The corners of the tick box: pulp paper inside a two-pixel ink rule, standing on the floor. */
const BOX = { left: 8, top: 6, right: 23, bottom: 21 } as const;

/** The empty tick box. */
function tickBox(t: Pixmap): Pixmap {
	fillRect(t, BOX.left, BOX.top, BOX.right, BOX.bottom, c.INK);
	fillRect(t, BOX.left + 2, BOX.top + 2, BOX.right - 2, BOX.bottom - 2, c.PAPER);
	return t;
}

/** The tick: an ink cross, two pixels wide, inside the box. */
function cross(t: Pixmap): Pixmap {
	const [left, top, right] = [BOX.left + 4, BOX.top + 4, BOX.right - 4];
	for (let k = 0; k <= right - left - 1; k++) {
		fillRect(t, left + k, top + k, left + k + 1, top + k, c.INK);
		fillRect(t, right - k - 1, top + k, right - k, top + k, c.INK);
	}
	return t;
}
