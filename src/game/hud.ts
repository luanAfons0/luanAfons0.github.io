import { drawText, GLYPH_HEIGHT, textWidth, undrawableChar } from "../engine/font";
import { type Framebuffer, rgb } from "../engine/framebuffer";
import type { HudColors } from "./theme";

/** What the HUD shows. The Game core fills it from its state each frame. */
export interface HudView {
	/** The current Room name, or null before the player enters a Room. */
	room: string | null;
	/** Bugs fixed out of the total, like "3/7", or null when the Level has no Bugs. */
	bugsFixed: string | null;
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
}

/**
 * The status bar sections, left to right. To show something new
 * (for example a new counter), add a field to `HudView` and a section here.
 */
const SECTIONS: readonly StatusBarSection[] = [
	{ label: "ROOM", value: (view) => view.room },
	{ label: "BUGS FIXED", width: 120, value: (view) => view.bugsFixed },
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

/** The HUD, in the colors of an art set. */
export function createHud(screenWidth: number, screenHeight: number, colors: Readonly<HudColors>): Hud {
	const color = packColors(colors);
	const top = screenHeight - STATUS_BAR_HEIGHT;
	const boxes = layOut(screenWidth, top);
	const centerX = screenWidth >> 1;
	const centerY = top >> 1;

	return {
		draw(framebuffer, view) {
			const arm = CROSSHAIR_REACH - CROSSHAIR_GAP + 1;
			fillRect(framebuffer, centerX - CROSSHAIR_REACH, centerY, arm, 1, color.crosshair);
			fillRect(framebuffer, centerX + CROSSHAIR_GAP, centerY, arm, 1, color.crosshair);
			fillRect(framebuffer, centerX, centerY - CROSSHAIR_REACH, 1, arm, color.crosshair);
			fillRect(framebuffer, centerX, centerY + CROSSHAIR_GAP, 1, arm, color.crosshair);
			fillRect(framebuffer, 0, top, screenWidth, STATUS_BAR_HEIGHT, color.bar);
			fillRect(framebuffer, 0, top, screenWidth, 1, color.outline);
			for (const box of boxes) {
				outlineRect(framebuffer, box, color.outline);
				drawText(framebuffer, box.section.label, box.x + PADDING, box.y + 4, color.label);
				const value = box.section.value(view);
				if (value !== null) {
					drawText(
						framebuffer,
						value,
						box.x + PADDING,
						box.y + box.height - 4 - GLYPH_HEIGHT * VALUE_SCALE,
						color.value,
						VALUE_SCALE,
						box.width - 2 * PADDING,
					);
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

function layOut(screenWidth: number, top: number): SectionBox[] {
	const height = STATUS_BAR_HEIGHT - 2 * MARGIN;
	const fixed = SECTIONS.reduce((sum, section) => sum + (section.width ?? 0), 0);
	const flexible = SECTIONS.filter((section) => section.width === undefined).length;
	const free = screenWidth - fixed - MARGIN * (SECTIONS.length + 1);
	let x = MARGIN;
	return SECTIONS.map((section) => {
		const width = section.width ?? Math.floor(free / flexible);
		const box = { section, x, y: top + MARGIN, width, height };
		x += width + MARGIN;
		return box;
	});
}

/** The HUD colors as framebuffer pixels, packed once so frames do no work for them. */
type PackedHudColors = Record<keyof HudColors, number>;

function packColors(colors: Readonly<HudColors>): PackedHudColors {
	const packed = {} as PackedHudColors;
	for (const key of Object.keys(colors) as (keyof HudColors)[]) packed[key] = rgb(...colors[key]);
	return packed;
}

/** A silkscreen outline: one pixel on each edge of the section, no fill, no bevel. */
function outlineRect(framebuffer: Framebuffer, box: SectionBox, color: number): void {
	const { x, y, width, height } = box;
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
