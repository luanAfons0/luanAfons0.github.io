import { drawText, GLYPH_HEIGHT, textWidth, undrawableChar } from "../engine/font";
import { type Framebuffer, rgb } from "../engine/framebuffer";
import type { HudColors } from "./theme";

/** What the HUD shows. The Game core fills it from its state each frame. */
export interface HudView {
	/** The current Room name, or null before the player enters a Room. */
	room: string | null;
	/** Bugs fixed out of the total, like "3/7", or null when the Level has no Bugs. */
	bugsFixed: string | null;
	/** How many Bugs are fixed: the ticked boxes of the Bug tally, when the art set has one. */
	bugsFixedCount: number;
	/** A short hint centered above the status bar (for example "Press E"), or null for none. */
	hint: string | null;
}

/** One outlined section of the status bar: a small label above a big value. */
interface StatusBarSection {
	label: string;
	/** Width in pixels. A section with no width takes the space the others leave. */
	width?: number;
	/** The value to show, or null to show nothing. */
	value(view: HudView): string | null;
	/** True for the section that shows the Bug tally after its value, when the art set has a tally. */
	tally?: boolean;
}

/**
 * The status bar sections, left to right. To show something new
 * (for example a new counter), add a field to `HudView` and a section here.
 */
const SECTIONS: readonly StatusBarSection[] = [
	{ label: "ROOM", value: (view) => view.room },
	{ label: "BUGS FIXED", width: 120, tally: true, value: (view) => view.bugsFixed },
];

/** The status bar is this many pixels high, across the bottom of the frame. */
export const STATUS_BAR_HEIGHT = 40;
const HINT_SCALE = 2;
/** Space between the hint and the top of the status bar, in pixels. */
const HINT_GAP = 16;

/** The crosshair sits in the middle of the 3D view, where shots go. Each crosshair arm runs from this many pixels away from the center... */
const CROSSHAIR_GAP = 2;
/** ...to this many. */
const CROSSHAIR_REACH = 5;

/** The eight neighbors of a pixel, for the one-pixel outline around the hint. */
const OUTLINE_OFFSETS: readonly (readonly [number, number])[] = [
	[-1, -1],
	[0, -1],
	[1, -1],
	[-1, 0],
	[1, 0],
	[-1, 1],
	[0, 1],
	[1, 1],
];

const MARGIN = 4;
const PADDING = 6;
const VALUE_SCALE = 2;
/** The row of the big value, from the top of its section. */
const VALUE_TOP = STATUS_BAR_HEIGHT - 2 * MARGIN - 4 - GLYPH_HEIGHT * VALUE_SCALE;

/** Each box of the Bug tally is a square this many pixels across, with an X in it when ticked. */
const TALLY_BOX = 7;
/** The boxes start this many pixels apart. */
const TALLY_PITCH = 10;
/** Space between the value and the first box, in pixels. */
const TALLY_GAP = 8;
/** The first box sits this many pixels below the top of the value, so it is centered on it. */
const TALLY_DROP = 4;
/** With a tally, its section is at least this wide, so the tally of seven Bugs has room to spare. */
const TALLY_SECTION_WIDTH = 150;

interface SectionBox {
	section: StatusBarSection;
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface Hud {
	/** Draws the crosshair and the status bar over the frame. It allocates no memory. */
	draw(framebuffer: Framebuffer, view: HudView): void;
}

/**
 * The HUD, in the colors of an art set. `bugsTotal` is the number of Bugs in the Level: the
 * boxes of the Bug tally, when the art set has one. It fails when the tally does not fit in the status bar.
 */
export function createHud(screenWidth: number, screenHeight: number, colors: Readonly<HudColors>, bugsTotal = 0): Hud {
	const color = packColors(colors);
	const top = screenHeight - STATUS_BAR_HEIGHT;
	const tallyBoxes = color.tally === null ? 0 : bugsTotal;
	const boxes = layOut(screenWidth, top, tallyBoxes);
	const centerX = screenWidth >> 1;
	const centerY = top >> 1;
	const arm = CROSSHAIR_REACH - CROSSHAIR_GAP + 1;
	// The four arms of the crosshair, as [x, y, width, height].
	const arms: readonly (readonly [number, number, number, number])[] = [
		[centerX - CROSSHAIR_REACH, centerY, arm, 1],
		[centerX + CROSSHAIR_GAP, centerY, arm, 1],
		[centerX, centerY - CROSSHAIR_REACH, 1, arm],
		[centerX, centerY + CROSSHAIR_GAP, 1, arm],
	];

	return {
		draw(framebuffer, view) {
			if (color.crosshairOutline !== null) {
				// A one-pixel outline in all eight directions, then the arms on top.
				for (const [x, y, width, height] of arms) {
					fillRect(framebuffer, x - 1, y - 1, width + 2, height + 2, color.crosshairOutline);
				}
			}
			for (const [x, y, width, height] of arms) fillRect(framebuffer, x, y, width, height, color.crosshair);
			fillRect(framebuffer, 0, top, screenWidth, STATUS_BAR_HEIGHT, color.bar);
			fillRect(framebuffer, 0, top, screenWidth, 1, color.outline);
			for (const box of boxes) {
				outlineRect(framebuffer, box.x, box.y, box.width, box.height, color.outline);
				drawText(framebuffer, box.section.label, box.x + PADDING, box.y + 4, color.label);
				const value = box.section.value(view);
				if (value === null) continue;
				const valueY = box.y + VALUE_TOP;
				drawText(framebuffer, value, box.x + PADDING, valueY, color.value, VALUE_SCALE, box.width - 2 * PADDING);
				if (box.section.tally && color.tally !== null) {
					const tallyX = box.x + PADDING + textWidth(value, VALUE_SCALE) + TALLY_GAP;
					drawTally(framebuffer, tallyX, valueY + TALLY_DROP, tallyBoxes, view.bugsFixedCount, color.tally);
				}
			}
			if (view.hint !== null) {
				const x = Math.round((screenWidth - textWidth(view.hint, HINT_SCALE)) / 2);
				const y = top - HINT_GAP - GLYPH_HEIGHT * HINT_SCALE;
				// A one-pixel outline in all eight directions, then the hint on top.
				for (const [dx, dy] of OUTLINE_OFFSETS) {
					drawText(framebuffer, view.hint, x + dx, y + dy, color.hintOutline, HINT_SCALE);
				}
				drawText(framebuffer, view.hint, x, y, color.hint, HINT_SCALE);
			}
		},
	};
}

/** Fails with a clear error when the HUD font cannot draw `text`. `what` names the text, like `Room "Lobby"`. */
export function assertHudCanDraw(text: string, what: string): void {
	const char = undrawableChar(text);
	if (char !== undefined) throw new Error(`${what} has a character the HUD cannot draw: "${char}".`);
}

/** Places the sections. With `tallyBoxes` boxes, the tally section grows to fit them after its widest value. */
function layOut(screenWidth: number, top: number, tallyBoxes: number): SectionBox[] {
	const height = STATUS_BAR_HEIGHT - 2 * MARGIN;
	const widthOf = (section: StatusBarSection): number | undefined => {
		if (!section.tally || tallyBoxes === 0 || section.width === undefined) return section.width;
		const widestValue = textWidth(`${tallyBoxes}/${tallyBoxes}`, VALUE_SCALE);
		const tally = TALLY_PITCH * (tallyBoxes - 1) + TALLY_BOX;
		return Math.max(section.width, TALLY_SECTION_WIDTH, 2 * PADDING + widestValue + TALLY_GAP + tally);
	};
	const widths = SECTIONS.map(widthOf);
	const fixed = widths.reduce<number>((sum, width) => sum + (width ?? 0), 0);
	const flexible = widths.filter((width) => width === undefined).length;
	const free = screenWidth - fixed - MARGIN * (SECTIONS.length + 1);
	const flexibleWidth = Math.floor(free / flexible);
	// A section that takes the space left must still hold its label, or the boxes run off the screen.
	for (const [i, section] of SECTIONS.entries()) {
		if (widths[i] !== undefined || flexibleWidth >= 2 * PADDING + textWidth(section.label)) continue;
		throw new Error(
			`The HUD Bug tally of ${tallyBoxes} Bugs does not fit in the ${screenWidth}-pixel status bar. Use fewer Bugs, or an art set with no tally.`,
		);
	}
	let x = MARGIN;
	return SECTIONS.map((section, i) => {
		const width = widths[i] ?? flexibleWidth;
		const box = { section, x, y: top + MARGIN, width, height };
		x += width + MARGIN;
		return box;
	});
}

/** The HUD colors as framebuffer pixels (null stays null), packed once so frames do no work for them. */
type PackedHudColors = { [Key in keyof HudColors]: null extends HudColors[Key] ? number | null : number };

function packColors(colors: Readonly<HudColors>): PackedHudColors {
	const packed: Record<string, number | null> = {};
	for (const [key, value] of Object.entries(colors)) packed[key] = value === null ? null : rgb(...value);
	return packed as PackedHudColors;
}

/** The Bug tally: `count` tick boxes in a row from (x, y), the first `ticked` with an X in them. */
function drawTally(framebuffer: Framebuffer, x: number, y: number, count: number, ticked: number, color: number): void {
	for (let i = 0; i < count; i++) {
		const left = x + i * TALLY_PITCH;
		outlineRect(framebuffer, left, y, TALLY_BOX, TALLY_BOX, color);
		if (i >= ticked) continue;
		for (let d = 1; d < TALLY_BOX - 1; d++) {
			setPixel(framebuffer, left + d, y + d, color);
			setPixel(framebuffer, left + TALLY_BOX - 1 - d, y + d, color);
		}
	}
}

function setPixel(framebuffer: Framebuffer, x: number, y: number, color: number): void {
	framebuffer.pixels[y * framebuffer.width + x] = color;
}

/** A one-pixel outline of a rectangle (a section or a tally box), no fill, no bevel. */
function outlineRect(
	framebuffer: Framebuffer,
	x: number,
	y: number,
	width: number,
	height: number,
	color: number,
): void {
	fillRect(framebuffer, x, y, width, 1, color);
	fillRect(framebuffer, x, y + height - 1, width, 1, color);
	fillRect(framebuffer, x, y, 1, height, color);
	fillRect(framebuffer, x + width - 1, y, 1, height, color);
}

function fillRect(framebuffer: Framebuffer, x: number, y: number, width: number, height: number, color: number): void {
	const { pixels } = framebuffer;
	for (let row = y; row < y + height; row++) {
		const start = row * framebuffer.width + x;
		pixels.fill(color, start, start + width);
	}
}
