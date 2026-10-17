/**
 * The Exhibit posters: one per Exhibit of the Content, a component on solder mask with its Part
 * label in silkscreen above it and a copper outline around it (copper marks live things). The
 * component shows the kind: an IC for a project (U), a connector for a contact (J), a resistor for
 * a skill (R), and a transistor for a job (Q).
 *
 * A poster is 72x66, drawn on a 36x33 grid at twice the size: the game shows it at 36x33 inside
 * its frame on a 64x64 wall (`src/game/poster.ts`), so every line stays.
 */
import { EXHIBITS, type Exhibit, type ExhibitKind, partLabel } from "../../src/game/content.ts";
import { createPixmap, fillRect, outlineRect, type Pixmap, path, plot, seededRandom, text } from "../art-kit/pixmap.ts";
import { type GeneratedFile, pngFile } from "./files.ts";
import * as c from "./palette.ts";

const WIDTH = 36;
const HEIGHT = 33;
const SCALE = 2;
/** Poster paths in the Content are relative to `public/`. The generator writes under `public/machine/`. */
const FOLDER = "machine/";
/** The faint marking on a package, such as the pin-1 dot. */
const MARK = 0x2a2e32;

/**
 * One poster for each Exhibit, at the path its `poster` names, with its Part label in the image
 * and in a `Title` text chunk. Fails when a poster is not in the machine art folder.
 */
export function posters(content: readonly Exhibit[] = EXHIBITS): GeneratedFile[] {
	return content.map((exhibit) => {
		if (!exhibit.poster.startsWith(FOLDER)) {
			throw new Error(
				`Exhibit "${exhibit.id}" has the poster "${exhibit.poster}". Put it under ${FOLDER}posters/ so the generator draws it.`,
			);
		}
		const label = partLabel(content, exhibit);
		return pngFile(exhibit.poster.slice(FOLDER.length), scaled(poster(exhibit.kind, label)), { Title: label });
	});
}

function poster(kind: ExhibitKind, label: string): Pixmap {
	const t = solderMask(79);
	// Traces run into the component from the edges.
	path(
		t,
		[
			[0, 21],
			[3, 21],
		],
		c.TRACE,
	);
	path(
		t,
		[
			[32, 16],
			[35, 16],
		],
		c.TRACE,
	);
	text(t, label, Math.floor((WIDTH - (label.length * 6 - 1)) / 2), 2, c.SILK);
	outlineRect(t, 3, 11, 32, 31, c.COPPER);
	COMPONENTS[kind](t);
	return t;
}

/** The component of each kind, drawn inside the copper outline. */
const COMPONENTS: Readonly<Record<ExhibitKind, (t: Pixmap) => void>> = {
	project: ic,
	contact: connector,
	skill: resistor,
	job: transistor,
};

/** An IC: an epoxy body with five silver pins on each side and a pin-1 dot. */
function ic(t: Pixmap): void {
	body(t, 11, 13, 24, 29);
	for (let y = 15; y <= 27; y += 3) {
		fillRect(t, 7, y, 10, y, c.SILVER);
		fillRect(t, 25, y, 28, y, c.SILVER);
	}
	fillRect(t, 13, 15, 14, 16, MARK);
	fillRect(t, 14, 26, 21, 26, MARK);
}

/** A pin header: a dark housing with a row of five square silver pins; pin 1 has a square pad. */
function connector(t: Pixmap): void {
	fillRect(t, 6, 17, 29, 25, c.EDGE);
	outlineRect(t, 6, 17, 29, 25, c.SILVER_DK);
	for (let x = 8; x <= 24; x += 4) fillRect(t, x, 20, x + 3, 22, c.SILVER_DK);
	for (let x = 8; x <= 24; x += 4) fillRect(t, x + 1, 20, x + 2, 21, c.SILVER);
	outlineRect(t, 8, 19, 11, 23, c.SILK);
}

/** A chip resistor: an epoxy body between two tinned end caps, with a marking line. */
function resistor(t: Pixmap): void {
	body(t, 10, 16, 25, 26);
	fillRect(t, 10, 16, 13, 26, c.SILVER);
	fillRect(t, 22, 16, 25, 26, c.SILVER);
	fillRect(t, 10, 16, 13, 16, c.SILVER_DK);
	fillRect(t, 22, 16, 25, 16, c.SILVER_DK);
	fillRect(t, 15, 21, 20, 21, MARK);
}

/** A transistor: a round-topped epoxy body with a flat face and three silver legs. */
function transistor(t: Pixmap): void {
	body(t, 11, 14, 24, 24);
	for (const [x, y] of [
		[11, 14],
		[12, 14],
		[11, 15],
		[24, 14],
		[23, 14],
		[24, 15],
	] as const) {
		plot(t, x, y, c.MASK);
	}
	fillRect(t, 13, 14, 22, 14, c.EPOXY_LIT);
	fillRect(t, 13, 22, 22, 22, MARK);
	for (const x of [13, 17, 21]) fillRect(t, x, 25, x + 1, 29, c.SILVER);
}

/** An epoxy package between two corners: lit on the top and left edges, shaded on the bottom and right. */
function body(t: Pixmap, x0: number, y0: number, x1: number, y1: number): void {
	fillRect(t, x0, y0, x1, y1, c.EPOXY);
	fillRect(t, x0, y0, x1, y0, c.EPOXY_LIT);
	fillRect(t, x0, y0, x0, y1, c.EPOXY_LIT);
	fillRect(t, x0, y1, x1, y1, c.EPOXY_SHADOW);
	fillRect(t, x1, y0, x1, y1, c.EPOXY_SHADOW);
}

/** Matte solder mask: the base color with sparse light and dark specks. */
function solderMask(seed: number): Pixmap {
	const pixmap = createPixmap(WIDTH, HEIGHT);
	const random = seededRandom(seed);
	for (let i = 0; i < pixmap.pixels.length; i++) {
		const r = random();
		pixmap.pixels[i] = r < 0.14 ? c.MASK_HI : r < 0.24 ? c.MASK_LO : c.MASK;
	}
	return pixmap;
}

/** The pixmap at `SCALE` times its size: each pixel becomes a square of pixels. */
function scaled(pixmap: Pixmap): Pixmap {
	const out = createPixmap(pixmap.width * SCALE, pixmap.height * SCALE);
	for (let y = 0; y < out.height; y++) {
		for (let x = 0; x < out.width; x++) {
			out.pixels[y * out.width + x] = pixmap.pixels[
				Math.floor(y / SCALE) * pixmap.width + Math.floor(x / SCALE)
			] as number;
		}
	}
	return out;
}
