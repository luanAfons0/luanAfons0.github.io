import { createFramebuffer } from "./engine/framebuffer";
import { createKeyboardInput, type InputSnapshot } from "./engine/input";
import { createFixedStepLoop } from "./engine/loop";
import { createMouseLook } from "./engine/pointer-lock";
import { loadTexture } from "./engine/texture";
import { EXHIBITS } from "./game/content";
import { createExhibitPanel } from "./game/exhibit-panel";
import { createGame, levelTextureNames, SCREEN_HEIGHT, SCREEN_WIDTH, TICKS_PER_SECOND } from "./game/game";
import sampleLevel from "./game/levels/sample.json";
import { createPauseMenu } from "./game/pause-menu";
import { loadSettings, saveSettings } from "./game/settings";

// The browser shell: it owns the canvas, the clock, the keyboard, the mouse, and the overlays.
// Everything it does is manual-test only; the Game core has the tests.

const canvas = document.querySelector<HTMLCanvasElement>("#screen");
const context = canvas?.getContext("2d");
if (!canvas || !context) throw new Error("The page has no #screen canvas with a 2D context.");
canvas.width = SCREEN_WIDTH;
canvas.height = SCREEN_HEIGHT;

// Decode every wall texture and Exhibit poster once, before the first frame.
// The wall PNGs are in public/freedoom/, the posters in public/posters/.
const [textureEntries, posterEntries] = await Promise.all([
	Promise.all(
		levelTextureNames(sampleLevel).map(
			async (name) => [name, await loadTexture(`${import.meta.env.BASE_URL}freedoom/textures/${name}.png`)] as const,
		),
	),
	Promise.all(
		EXHIBITS.map(async ({ id, poster }) => [id, await loadTexture(`${import.meta.env.BASE_URL}${poster}`)] as const),
	),
]);
const settings = loadSettings();
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const game = createGame({
	level: sampleLevel,
	content: EXHIBITS,
	textures: Object.fromEntries(textureEntries),
	posters: Object.fromEntries(posterEntries),
	settings: {
		mouseSensitivity: settings.mouseSensitivity,
		invertMouse: settings.invertMouse,
		reducedMotion: reducedMotion.matches,
	},
});
reducedMotion.addEventListener("change", (event) => game.updateSettings({ reducedMotion: event.matches }));

const keyboard = createKeyboardInput(window);
const mouse = createMouseLook(canvas, (locked) => {
	// The browser releases the mouse when the player presses Esc (or leaves the window): pause.
	// An open Exhibit Panel releases the mouse on purpose, so the visitor can click its links.
	if (!locked && !exhibitPanel.isOpen()) openPauseMenu();
});
const exhibitPanel = createExhibitPanel({ parent: document.body, onClose: closeExhibitPanel });
const exhibitsById = new Map(EXHIBITS.map((exhibit) => [exhibit.id, exhibit]));
const pauseMenu = createPauseMenu({
	parent: document.body,
	settings,
	onResume: resume,
	onSettingsChange(changed) {
		// The sound setting is saved here; the Audio module will read it.
		game.updateSettings({ mouseSensitivity: changed.mouseSensitivity, invertMouse: changed.invertMouse });
		saveSettings(changed);
	},
});

function openPauseMenu(): void {
	if (pauseMenu.isOpen()) return;
	game.pause();
	pauseMenu.open();
}

function resume(): void {
	pauseMenu.close();
	game.resume();
	canvas?.focus();
	// Resume is a click or key press, so the browser lets the page capture the mouse again.
	mouse.lock();
}

/** Shows the Exhibit Panel when the Game core opened an Exhibit (the player pressed E on it). */
function showOpenExhibit(): void {
	const id = game.state().openExhibit;
	if (id === null || exhibitPanel.isOpen()) return;
	const exhibit = exhibitsById.get(id);
	if (!exhibit) throw new Error(`The Game core opened Exhibit "${id}", which is not in the Content.`);
	exhibitPanel.open(exhibit);
	// Release the mouse so the visitor can click the links. The lock callback sees the open panel.
	mouse.unlock();
}

function closeExhibitPanel(): void {
	exhibitPanel.close();
	game.closeExhibit();
	canvas?.focus();
	// A click on Close lets the page capture the mouse again. The browser can refuse it after Esc
	// (Esc is not a user gesture); then the next click into the game captures it.
	mouse.lock();
}

// A click into the game captures the mouse.
canvas.addEventListener("click", () => {
	if (!pauseMenu.isOpen() && !exhibitPanel.isOpen()) mouse.lock();
});
// While the mouse is captured, the browser keeps Esc and releases the mouse (see above).
// Without capture (keyboard-only play, or an open Exhibit Panel), Esc reaches the page.
window.addEventListener("keydown", (event) => {
	if (event.code !== "Escape") return;
	if (exhibitPanel.isOpen()) {
		event.preventDefault();
		closeExhibitPanel();
	} else if (!mouse.isLocked()) {
		openPauseMenu();
	}
});

const loop = createFixedStepLoop({ ticksPerSecond: TICKS_PER_SECOND });
const framebuffer = createFramebuffer(SCREEN_WIDTH, SCREEN_HEIGHT);
// Shares memory with the framebuffer, so there is no copy per frame.
const image = new ImageData(new Uint8ClampedArray(framebuffer.pixels.buffer), SCREEN_WIDTH, SCREEN_HEIGHT);

const input: InputSnapshot = { forward: 0, strafe: 0, turn: 0, look: 0, use: false };
const tick = () => {
	Object.assign(input, keyboard.snapshot());
	// All mouse movement since the last tick goes into this tick, so none is lost or counted twice.
	input.look = mouse.takeLook();
	game.step(input);
};
let last: number | undefined;

function frame(now: number): void {
	loop.advance(last === undefined ? 0 : now - last, tick);
	last = now;
	showOpenExhibit();
	game.render(framebuffer);
	context?.putImageData(image, 0, 0);
	requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
