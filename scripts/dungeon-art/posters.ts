/**
 * The Exhibit posters: one pulp banner per Exhibit of the Content, hung on an iron rod over cut
 * stone, as in the approved mock's game frame. The Part label sits in a ruled ink box, and a
 * pictogram under it shows the kind: a map for a project (U), a sealed letter for a contact (J),
 * an open book for a skill (R), and a quartered shield for a job (Q).
 *
 * A poster is 72x66, drawn on a 36x33 grid at twice the size: the game shows it at 36x33 inside
 * its frame on a 64x64 wall (`src/game/poster.ts`), so every line stays and the stone matches the
 * texel size of the walls.
 */
import { EXHIBITS, type Exhibit, type ExhibitKind } from "../../src/game/content.ts";
import { posterFiles } from "../art-kit/kinds.ts";
import { createPixmap, fillRect, line, outlineRect, type Pixmap, plot, seededRandom, text } from "../art-kit/pixmap.ts";
import { type GeneratedFile, pngFile } from "./files.ts";
import * as c from "./palette.ts";
import { colorAt, stoneWall } from "./stone.ts";

const WIDTH = 36;
const HEIGHT = 33;
const SCALE = 2;
/** The cloth of the banner, between two corners, with a swallowtail notch from `notchTop` down. */
const CLOTH = { left: 6, top: 3, right: 29, bottom: HEIGHT - 1, notchTop: 30 } as const;
/** The ruled box of the Part label. */
const LABEL_BOX = { left: 9, top: 5, right: 26, bottom: 15 } as const;

/**
 * One banner for each Exhibit, named by its id in the posters folder (`posters/<id>.png`, where the
 * dungeon art set looks for it), with its Part label in the image and in a `Title` text chunk.
 */
export function posters(content: readonly Exhibit[] = EXHIBITS): GeneratedFile[] {
	return posterFiles(pngFile, content, banner, SCALE);
}

function banner(kind: ExhibitKind, label: string): Pixmap {
	const t = stoneBehind();
	const random = seededRandom(83);
	for (let y = 0; y < HEIGHT; y++) {
		for (let x = 0; x < WIDTH; x++) {
			if (onCloth(x, y)) {
				const edge = !onCloth(x - 1, y) || !onCloth(x + 1, y) || !onCloth(x, y - 1) || !onCloth(x, y + 1);
				plot(t, x, y, edge ? c.INK : random() < 0.05 ? c.PAPER_DK : c.PAPER);
			} else if (onCloth(x - 1, y - 1) && colorAt(t, x, y) !== c.MORTAR) {
				plot(t, x, y, c.STONE_LO); // the shadow of the banner on the stone
			}
		}
	}
	// The rod and its knobs.
	fillRect(t, 3, 1, 32, 2, c.IRON);
	fillRect(t, 4, 1, 31, 1, c.IRON_HI);
	fillRect(t, 1, 0, 3, 3, c.IRON);
	fillRect(t, 32, 0, 34, 3, c.IRON);
	plot(t, 2, 1, c.RIVET);
	plot(t, 33, 1, c.RIVET);
	outlineRect(t, LABEL_BOX.left, LABEL_BOX.top, LABEL_BOX.right, LABEL_BOX.bottom, c.INK);
	const boxWidth = LABEL_BOX.right - LABEL_BOX.left + 1;
	text(t, label, LABEL_BOX.left + Math.floor((boxWidth - (label.length * 6 - 1)) / 2), LABEL_BOX.top + 2, c.INK);
	PICTOGRAMS[kind](t);
	return t;
}

/** A crop of even cut stone, at the texel size of the walls. */
function stoneBehind(): Pixmap {
	const wall = stoneWall(79, false);
	const t = createPixmap(WIDTH, HEIGHT);
	for (let y = 0; y < HEIGHT; y++) {
		for (let x = 0; x < WIDTH; x++) plot(t, x, y, colorAt(wall, x + 14, y + 16) as number);
	}
	return t;
}

function onCloth(x: number, y: number): boolean {
	if (x < CLOTH.left || x > CLOTH.right || y < CLOTH.top || y > CLOTH.bottom) return false;
	if (y < CLOTH.notchTop) return true;
	const half = (y - CLOTH.notchTop + 1) * 2;
	return x <= 17 - half || x >= 18 + half;
}

/** The pictogram of each kind, drawn in ink under the Part label. */
const PICTOGRAMS: Readonly<Record<ExhibitKind, (t: Pixmap) => void>> = {
	project: map,
	contact: letter,
	skill: book,
	job: shield,
};

/** An unrolled map: two rolls, a sheet, a mountain, a dotted path, and an X. */
function map(t: Pixmap): void {
	outlineRect(t, 9, 18, 11, 27, c.INK);
	outlineRect(t, 24, 18, 26, 27, c.INK);
	fillRect(t, 10, 19, 10, 26, c.PAPER_DK);
	fillRect(t, 25, 19, 25, 26, c.PAPER_DK);
	line(t, [12, 19], [23, 19], c.INK);
	line(t, [12, 26], [23, 26], c.INK);
	for (const [x, y] of [
		[12, 23],
		[13, 22],
		[14, 21],
		[15, 22],
		[16, 23],
		[13, 24],
		[15, 24],
		[17, 23],
		[18, 22],
	] as const) {
		plot(t, x, y, c.INK);
	}
	line(t, [19, 20], [22, 23], c.INK);
	line(t, [22, 20], [19, 23], c.INK);
}

/** A sealed letter: an envelope with its flap and a wax seal. */
function letter(t: Pixmap): void {
	outlineRect(t, 10, 19, 25, 27, c.INK);
	line(t, [10, 19], [17, 24], c.INK);
	line(t, [25, 19], [18, 24], c.INK);
	fillRect(t, 16, 24, 19, 26, c.INK);
	plot(t, 16, 26, c.PAPER);
	plot(t, 19, 26, c.PAPER);
}

/** An open book: two pages with lines of text, and the spine between them. */
function book(t: Pixmap): void {
	outlineRect(t, 9, 20, 26, 27, c.INK);
	fillRect(t, 17, 19, 18, 27, c.INK);
	plot(t, 9, 20, c.PAPER);
	plot(t, 26, 20, c.PAPER);
	line(t, [10, 19], [16, 19], c.INK);
	line(t, [19, 19], [25, 19], c.INK);
	for (const y of [22, 24]) {
		line(t, [11, y], [15, y], c.INK2);
		line(t, [20, y], [24, y], c.INK2);
	}
	line(t, [11, 26], [13, 26], c.INK2);
	line(t, [20, 26], [22, 26], c.INK2);
}

/** A heater shield, quartered by an ink cross. */
function shield(t: Pixmap): void {
	const inside = (x: number, y: number): boolean => {
		if (y < 18 || y > 27) return false;
		const half = y <= 21 ? 6.5 : 6.5 * Math.sqrt(1 - ((y - 21) / 7) ** 2);
		return Math.abs(x + 0.5 - 18) <= half;
	};
	for (let y = 18; y <= 27; y++) {
		for (let x = 9; x <= 26; x++) {
			if (!inside(x, y)) continue;
			const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
			plot(t, x, y, edge || x === 17 || x === 18 || y === 21 ? c.INK : c.PAPER);
		}
	}
}
