import { drawText, GLYPH_HEIGHT, textWidth, undrawableChar } from "../engine/font";
import { type Framebuffer, rgb } from "../engine/framebuffer";

/** What the HUD shows. The Game core fills it from its state each frame. */
export interface HudView {
	/** The current Room name, or null before the player enters a Room. */
	room: string | null;
	/** A short hint centered above the status bar (for example "Press E"), or null for none. */
	hint: string | null;
}

/** One boxed section of the status bar: a small label above a big value. */
interface StatusBarSection {
	label: string;
	/** Width in pixels. A section with no width takes the space the others leave. */
	width?: number;
	/** The value to show, or null to show nothing. */
	value(view: HudView): string | null;
}

/**
 * The status bar sections, left to right. To show something new
 * (for example the Bugs fixed), add a field to `HudView` and a section here.
 */
const SECTIONS: readonly StatusBarSection[] = [{ label: "ROOM", value: (view) => view.room }];

/** The status bar is this many pixels high, across the bottom of the frame. */
export const STATUS_BAR_HEIGHT = 40;
/** The color of the values in the status bar (the big text). */
export const HUD_VALUE_COLOR = rgb(220, 40, 32);
/** The color of the hint above the status bar. */
export const HUD_HINT_COLOR = rgb(255, 216, 72);
const HINT_SHADOW_COLOR = rgb(0, 0, 0);
const HINT_SCALE = 2;
/** Space between the hint and the top of the status bar, in pixels. */
const HINT_GAP = 16;

const BAR_COLOR = rgb(92, 88, 80);
const BAR_EDGE_COLOR = rgb(150, 144, 132);
const SECTION_COLOR = rgb(48, 44, 40);
const BEVEL_DARK = rgb(32, 30, 28);
const BEVEL_LIGHT = rgb(136, 130, 118);
const LABEL_COLOR = rgb(200, 196, 180);
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
	/** Draws the status bar over the bottom of the frame. It allocates no memory. */
	draw(framebuffer: Framebuffer, view: HudView): void;
}

export function createHud(screenWidth: number, screenHeight: number): Hud {
	const top = screenHeight - STATUS_BAR_HEIGHT;
	const boxes = layOut(screenWidth, top);

	return {
		draw(framebuffer, view) {
			fillRect(framebuffer, 0, top, screenWidth, STATUS_BAR_HEIGHT, BAR_COLOR);
			fillRect(framebuffer, 0, top, screenWidth, 1, BAR_EDGE_COLOR);
			for (const box of boxes) {
				drawSectionBox(framebuffer, box);
				drawText(framebuffer, box.section.label, box.x + PADDING, box.y + 4, LABEL_COLOR);
				const value = box.section.value(view);
				if (value !== null) {
					drawText(
						framebuffer,
						value,
						box.x + PADDING,
						box.y + box.height - 4 - GLYPH_HEIGHT * VALUE_SCALE,
						HUD_VALUE_COLOR,
						VALUE_SCALE,
						box.width - 2 * PADDING,
					);
				}
			}
			if (view.hint !== null) {
				const x = Math.round((screenWidth - textWidth(view.hint, HINT_SCALE)) / 2);
				const y = top - HINT_GAP - GLYPH_HEIGHT * HINT_SCALE;
				drawText(framebuffer, view.hint, x + 1, y + 1, HINT_SHADOW_COLOR, HINT_SCALE);
				drawText(framebuffer, view.hint, x, y, HUD_HINT_COLOR, HINT_SCALE);
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

/** A sunken box: dark on the top and left edges, light on the bottom and right edges. */
function drawSectionBox(framebuffer: Framebuffer, box: SectionBox): void {
	const { x, y, width, height } = box;
	fillRect(framebuffer, x, y, width, height, SECTION_COLOR);
	fillRect(framebuffer, x, y, width, 1, BEVEL_DARK);
	fillRect(framebuffer, x, y, 1, height, BEVEL_DARK);
	fillRect(framebuffer, x, y + height - 1, width, 1, BEVEL_LIGHT);
	fillRect(framebuffer, x + width - 1, y, 1, height, BEVEL_LIGHT);
}

function fillRect(framebuffer: Framebuffer, x: number, y: number, width: number, height: number, color: number): void {
	const { pixels } = framebuffer;
	for (let row = y; row < y + height; row++) {
		const start = row * framebuffer.width + x;
		pixels.fill(color, start, start + width);
	}
}
