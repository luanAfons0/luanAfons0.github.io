import type { Framebuffer } from "./framebuffer";

/**
 * A small bitmap font, built into the code so no font file loads at runtime.
 * Each glyph is 5x7 pixels. Lowercase letters draw as uppercase.
 */
export const GLYPH_WIDTH = 5;
export const GLYPH_HEIGHT = 7;
/** Space between two glyphs, in font pixels. */
const GLYPH_GAP = 1;

/** Glyph shapes: one string per row, `#` is a lit pixel. */
const GLYPH_ROWS: Record<string, string[]> = {
	A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
	B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
	C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
	D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
	E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
	F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
	G: [".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".####"],
	H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
	I: [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
	J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
	K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
	L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
	M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
	N: ["#...#", "#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#"],
	O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
	P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
	Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
	R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
	S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
	T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
	U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
	V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
	W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "#.#.#", ".#.#."],
	X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
	Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
	Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
	"0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
	"1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
	"2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
	"3": ["#####", "...#.", "..#..", "...#.", "....#", "#...#", ".###."],
	"4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
	"5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
	"6": ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
	"7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
	"8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
	"9": [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
	" ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
	"-": [".....", ".....", ".....", ".###.", ".....", ".....", "....."],
	".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
	",": [".....", ".....", ".....", ".....", ".##..", "..#..", ".#..."],
	":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
	"/": ["....#", "....#", "...#.", "..#..", ".#...", "#....", "#...."],
	"!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
	"?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
	"'": ["..#..", "..#..", ".#...", ".....", ".....", ".....", "....."],
	"&": [".##..", "#..#.", "#.#..", ".#...", "#.#.#", "#..#.", ".##.#"],
	"(": ["...#.", "..#..", ".#...", ".#...", ".#...", "..#..", "...#."],
	")": [".#...", "..#..", "...#.", "...#.", "...#.", "..#..", ".#..."],
	"+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
	"#": [".#.#.", ".#.#.", "#####", ".#.#.", "#####", ".#.#.", ".#.#."],
	_: [".....", ".....", ".....", ".....", ".....", ".....", "#####"],
};

/** Glyph bitmaps by char code: one byte per row, bit 4 is the left column. */
const GLYPHS: (Uint8Array | undefined)[] = [];
for (const [char, rows] of Object.entries(GLYPH_ROWS)) {
	if (rows.length !== GLYPH_HEIGHT || rows.some((row) => row.length !== GLYPH_WIDTH)) {
		throw new Error(`Font glyph "${char}" must be ${GLYPH_WIDTH}x${GLYPH_HEIGHT}.`);
	}
	GLYPHS[char.charCodeAt(0)] = Uint8Array.from(rows, (row) =>
		Number.parseInt(row.replaceAll("#", "1").replaceAll(".", "0"), 2),
	);
}

function glyphFor(code: number): Uint8Array | undefined {
	// Lowercase a-z draws as uppercase A-Z.
	return GLYPHS[code >= 97 && code <= 122 ? code - 32 : code];
}

/** Returns the first character the font cannot draw, or undefined when it can draw all of `text`. */
export function undrawableChar(text: string): string | undefined {
	for (const char of text) {
		if (char.length !== 1 || !glyphFor(char.charCodeAt(0))) return char;
	}
	return undefined;
}

/** The width in pixels of `text` drawn at `scale`, without the gap after the last glyph. */
export function textWidth(text: string, scale = 1): number {
	return text.length === 0 ? 0 : (text.length * (GLYPH_WIDTH + GLYPH_GAP) - GLYPH_GAP) * scale;
}

/**
 * Draws `text` with its top-left corner at (x, y). Each font pixel is a `scale` x `scale` block.
 * It stops before a glyph that would pass `x + maxWidth`, and clips at the framebuffer edges.
 * A character the font cannot draw shows as a filled block, so the mistake is easy to see.
 * It allocates no memory.
 */
export function drawText(
	framebuffer: Framebuffer,
	text: string,
	x: number,
	y: number,
	color: number,
	scale = 1,
	maxWidth = Number.POSITIVE_INFINITY,
): void {
	const { width, height, pixels } = framebuffer;
	const advance = (GLYPH_WIDTH + GLYPH_GAP) * scale;
	const right = x + maxWidth;
	for (let c = 0, left = x; c < text.length; c++, left += advance) {
		if (left + GLYPH_WIDTH * scale > right) return;
		const glyph = glyphFor(text.charCodeAt(c));
		for (let row = 0; row < GLYPH_HEIGHT; row++) {
			const bits = glyph ? (glyph[row] as number) : 0xff;
			for (let column = 0; column < GLYPH_WIDTH; column++) {
				if (!(bits & (1 << (GLYPH_WIDTH - 1 - column)))) continue;
				const px = left + column * scale;
				const py = y + row * scale;
				for (let dy = 0; dy < scale; dy++) {
					const yy = py + dy;
					if (yy < 0 || yy >= height) continue;
					for (let dx = 0; dx < scale; dx++) {
						const xx = px + dx;
						if (xx >= 0 && xx < width) pixels[yy * width + xx] = color;
					}
				}
			}
		}
	}
}
