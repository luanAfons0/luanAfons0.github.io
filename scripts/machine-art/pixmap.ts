/**
 * A tiny pixel canvas for the generator: colors are 0xRRGGBB, and -1 is transparent.
 * Every drawing call clips to the pixmap, so art code can draw past the edges.
 */
export interface Pixmap {
	width: number;
	height: number;
	/** Row by row. */
	pixels: Int32Array;
}

export const TRANSPARENT = -1;

export type Point = readonly [x: number, y: number];

export function createPixmap(width: number, height: number, fill = TRANSPARENT): Pixmap {
	return { width, height, pixels: new Int32Array(width * height).fill(fill) };
}

/**
 * A seeded random number generator (mulberry32): the same seed always gives the same numbers,
 * so the art is the same on every run.
 */
export function seededRandom(seed: number): () => number {
	let state = seed;
	return () => {
		state = (state + 0x6d2b79f5) | 0;
		let t = Math.imul(state ^ (state >>> 15), 1 | state);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function plot(pixmap: Pixmap, x: number, y: number, color: number): void {
	if (x >= 0 && x < pixmap.width && y >= 0 && y < pixmap.height) pixmap.pixels[y * pixmap.width + x] = color;
}

/** A filled rectangle between two corners, both included. */
export function fillRect(pixmap: Pixmap, x0: number, y0: number, x1: number, y1: number, color: number): void {
	for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) plot(pixmap, x, y, color);
}

/** A one-pixel rectangle outline between two corners, both included. */
export function outlineRect(pixmap: Pixmap, x0: number, y0: number, x1: number, y1: number, color: number): void {
	for (let x = x0; x <= x1; x++) {
		plot(pixmap, x, y0, color);
		plot(pixmap, x, y1, color);
	}
	for (let y = y0; y <= y1; y++) {
		plot(pixmap, x0, y, color);
		plot(pixmap, x1, y, color);
	}
}

/** A straight line (Bresenham). Board art routes at 0, 45, and 90 degrees. */
export function line(pixmap: Pixmap, from: Point, to: Point, color: number): void {
	let [x, y] = from;
	const [x1, y1] = to;
	const dx = Math.abs(x1 - x);
	const dy = -Math.abs(y1 - y);
	const sx = x < x1 ? 1 : -1;
	const sy = y < y1 ? 1 : -1;
	let err = dx + dy;
	for (;;) {
		plot(pixmap, x, y, color);
		if (x === x1 && y === y1) return;
		const e2 = 2 * err;
		if (e2 >= dy) {
			err += dy;
			x += sx;
		}
		if (e2 <= dx) {
			err += dx;
			y += sy;
		}
	}
}

/** Lines through the points in order. A wide path is two pixels thick. */
export function path(pixmap: Pixmap, points: readonly Point[], color: number, wide = false): void {
	for (let i = 1; i < points.length; i++) {
		const [ax, ay] = points[i - 1] as Point;
		const [bx, by] = points[i] as Point;
		line(pixmap, [ax, ay], [bx, by], color);
		if (wide) {
			line(pixmap, [ax + 1, ay], [bx + 1, by], color);
			line(pixmap, [ax, ay + 1], [bx, by + 1], color);
		}
	}
}

export function disc(pixmap: Pixmap, cx: number, cy: number, radius: number, color: number): void {
	for (let y = -radius; y <= radius; y++) {
		for (let x = -radius; x <= radius; x++) {
			if (x * x + y * y <= radius * radius + radius) plot(pixmap, cx + x, cy + y, color);
		}
	}
}

/**
 * 5x7 glyphs for silkscreen text: seven rows, two hex digits per row, bit 4 is the left column.
 * The same shapes as the mock's game frame.
 */
const GLYPHS: Readonly<Record<string, string>> = {
	A: "0E11111F111111",
	B: "1E11111E11111E",
	C: "0E11101010110E",
	D: "1E11111111111E",
	E: "1F10101E10101F",
	F: "1F10101E101010",
	G: "0E11101711110F",
	H: "1111111F111111",
	I: "0E04040404040E",
	J: "0702020202120C",
	K: "11121418141211",
	L: "1010101010101F",
	M: "111B1515111111",
	N: "11111915131111",
	O: "0E11111111110E",
	P: "1E11111E101010",
	Q: "0E11111115120D",
	R: "1E11111E141211",
	S: "0F10100E01011E",
	T: "1F040404040404",
	U: "1111111111110E",
	V: "11111111110A04",
	W: "1111111515150A",
	X: "11110A040A1111",
	Y: "11110A04040404",
	Z: "1F01020408101F",
	"0": "0E11131519110E",
	"1": "040C040404040E",
	"2": "0E11010204081F",
	"3": "1F02040201110E",
	"4": "02060A121F0202",
	"5": "1F101E0101110E",
	"6": "0608101E11110E",
	"7": "1F010204080808",
	"8": "0E11110E11110E",
	"9": "0E11110F01020C",
	"/": "01010204081010",
	".": "00000000000C0C",
	":": "000C0C000C0C00",
	"-": "0000001F000000",
	" ": "00000000000000",
};

/** Glyphs advance this many pixels (at scale 1): five for the glyph, one for the gap. */
const ADVANCE = 6;

/** Draws text with its top-left corner at (x, y). Fails on a character the font has no glyph for. */
export function text(pixmap: Pixmap, value: string, x: number, y: number, color: number, scale = 1): void {
	for (const [index, char] of [...value].entries()) {
		const glyph = GLYPHS[char];
		if (glyph === undefined) throw new Error(`The generator font has no glyph for "${char}".`);
		const left = x + index * ADVANCE * scale;
		for (let row = 0; row < 7; row++) {
			const bits = Number.parseInt(glyph.slice(row * 2, row * 2 + 2), 16);
			for (let column = 0; column < 5; column++) {
				if (!(bits & (16 >> column))) continue;
				fillRect(
					pixmap,
					left + column * scale,
					y + row * scale,
					left + (column + 1) * scale - 1,
					y + (row + 1) * scale - 1,
					color,
				);
			}
		}
	}
}
