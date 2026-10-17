/**
 * The Bug frames: a friendly pixel-art beetle seen from above, 32x24, as in the approved mock's
 * game frame. Two walk frames move the legs in a tripod gait. The fix frames flash the beetle,
 * fade it out into a silkscreen box, and end in the "patched" mark: the box with a check, like the
 * patched board in the mock. The art set in `src/game/theme.ts` lists the same frame names.
 *
 * Sprite PNGs have no place for the anchor, so this module also writes `sprites/offsets.json`.
 */
import { type GeneratedFile, pngFile } from "./files.ts";
import * as c from "./palette.ts";
import { createPixmap, line, outlineRect, type Pixmap, type Point, path, plot, TRANSPARENT } from "./pixmap.ts";

const WIDTH = 32;
const HEIGHT = 24;

/**
 * The anchor of every frame: the middle of the frame, 14 texels above its bottom row. The Game
 * core puts the anchor 0.2 tiles above the floor and draws 72 texels per tile, so the beetle
 * stands on the floor.
 */
const ANCHOR = { left: WIDTH / 2, top: HEIGHT - 14 };

/**
 * The left half of the beetle, 12 columns from x = 4; the right half is its mirror. `o` outline,
 * `c` carapace, `s` sheen (light from the left only, so the right half shows carapace), `h` head,
 * `e` eye, `a` antenna.
 */
const BODY = [
	"....a.......",
	".....a......",
	"......a.....",
	".......aoooo",
	".......ohhhh",
	".......ohehh",
	".......ohhhh",
	"......oooooo",
	".....occcccc",
	".....ocssccc",
	".....ooooooo",
	"...occccccco",
	"..ocssccccco",
	"..ocssccccco",
	".ocsscccccco",
	".ocsscccccco",
	".ocsccccccco",
	".occccccccco",
	"..occcccccco",
	"..occcccccco",
	"...occccccco",
	"....ooccccco",
	"......oooooo",
];

const BODY_COLORS: Readonly<Record<string, number>> = {
	o: c.BEETLE_OUTLINE,
	c: c.BEETLE_SHELL,
	s: c.BEETLE_SHEEN,
	h: c.BEETLE_HEAD,
	e: c.SILK,
	a: c.BEETLE_LEG,
};

/** The three left legs (front, middle, back) of each walk pose. The right legs take the other pose. */
const LEGS: readonly (readonly (readonly Point[])[])[] = [
	[
		[
			[9, 9],
			[6, 7],
			[4, 4],
		],
		[
			[5, 14],
			[2, 15],
			[1, 18],
		],
		[
			[6, 20],
			[4, 22],
			[3, 23],
		],
	],
	[
		[
			[9, 9],
			[6, 9],
			[3, 8],
		],
		[
			[5, 14],
			[2, 13],
			[0, 11],
		],
		[
			[6, 20],
			[3, 20],
			[1, 22],
		],
	],
];

/**
 * Each frame by name. The art set plays the fix frames in this order and lists `beetle-patched`
 * three times, so the mark stays for half of the fix sequence.
 */
const FRAMES: Readonly<Record<string, () => Pixmap>> = {
	"beetle-walk-1": () => beetle(0),
	"beetle-walk-2": () => beetle(1),
	"beetle-fix-1": () => flash(beetle(0)),
	"beetle-fix-2": () => patchedBox(fade(beetle(0, false), 2), true),
	"beetle-fix-3": () => patchedBox(fade(beetle(0, false), 4), false),
	"beetle-patched": () => check(patchedBox(createPixmap(WIDTH, HEIGHT), false)),
};

export function bugs(): GeneratedFile[] {
	const offsets = Object.fromEntries(Object.keys(FRAMES).map((name) => [name, ANCHOR]));
	return [
		...Object.entries(FRAMES).map(([name, draw]) => pngFile(`sprites/${name}.png`, draw())),
		{ path: "sprites/offsets.json", bytes: Buffer.from(`${JSON.stringify(offsets, null, "\t")}\n`) },
	];
}

/** The beetle in walk pose 0 or 1. Without legs, it has pulled them in. */
function beetle(pose: 0 | 1, legs = true): Pixmap {
	const t = createPixmap(WIDTH, HEIGHT);
	const mirror = ([x, y]: Point): Point => [WIDTH - 1 - x, y];
	if (legs) {
		for (const leg of LEGS[pose] as (readonly Point[])[]) path(t, leg, c.BEETLE_LEG);
		for (const leg of LEGS[1 - pose] as (readonly Point[])[]) path(t, leg.map(mirror), c.BEETLE_LEG);
	}
	for (const [y, row] of BODY.entries()) {
		for (const [x, char] of [...row].entries()) {
			if (char === ".") continue;
			plot(t, x + 4, y, BODY_COLORS[char] as number);
			plot(t, 27 - x, y, BODY_COLORS[char === "s" ? "c" : char] as number);
		}
	}
	return t;
}

/** The hit: every pixel of the beetle turns silkscreen white for one frame. */
function flash(t: Pixmap): Pixmap {
	for (let i = 0; i < t.pixels.length; i++) if (t.pixels[i] !== TRANSPARENT) t.pixels[i] = c.SILK;
	return t;
}

/** Keeps one pixel in `step` along each row and column, in a regular grid, so the beetle breaks up. */
function fade(t: Pixmap, step: number): Pixmap {
	for (let y = 0; y < HEIGHT; y++) {
		for (let x = 0; x < WIDTH; x++) {
			const kept = step === 2 ? (x + y) % 2 === 0 : x % 2 === 0 && y % 2 === 0;
			if (!kept) t.pixels[y * WIDTH + x] = TRANSPARENT;
		}
	}
	return t;
}

/** The silkscreen box of the patched mark. With `cornersOnly`, only its four corners show. */
function patchedBox(t: Pixmap, cornersOnly: boolean): Pixmap {
	const [x0, y0, x1, y1] = [7, 3, 24, 20];
	if (!cornersOnly) {
		outlineRect(t, x0, y0, x1, y1, c.SILK);
		return t;
	}
	for (const [x, y, dx, dy] of [
		[x0, y0, 1, 1],
		[x1, y0, -1, 1],
		[x0, y1, 1, -1],
		[x1, y1, -1, -1],
	] as const) {
		line(t, [x, y], [x + 3 * dx, y], c.SILK);
		line(t, [x, y], [x, y + 3 * dy], c.SILK);
	}
	return t;
}

/** The check of the patched mark, two pixels wide. */
function check(t: Pixmap): Pixmap {
	path(
		t,
		[
			[11, 11],
			[14, 14],
			[20, 8],
		],
		c.SILK,
		true,
	);
	return t;
}
