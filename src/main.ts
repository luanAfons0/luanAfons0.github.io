import { createFramebuffer } from "./engine/framebuffer";
import { createKeyboardInput, type InputSnapshot } from "./engine/input";
import { createFixedStepLoop } from "./engine/loop";
import { createMouseLook } from "./engine/pointer-lock";
import type { SpriteImage } from "./engine/renderer";
import { loadTexture } from "./engine/texture";
import {
	BUG_SPRITE_NAMES,
	createGame,
	levelTextureNames,
	SCREEN_HEIGHT,
	SCREEN_WIDTH,
	TICKS_PER_SECOND,
} from "./game/game";
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

// Decode every wall texture and Bug sprite once, before the first frame. The PNGs are in public/freedoom/.
const freedoom = `${import.meta.env.BASE_URL}freedoom`;
const [textureEntries, spriteEntries] = await Promise.all([
	Promise.all(
		levelTextureNames(sampleLevel).map(
			async (name) => [name, await loadTexture(`${freedoom}/textures/${name}.png`)] as const,
		),
	),
	loadSprites(BUG_SPRITE_NAMES),
]);
const settings = loadSettings();
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const game = createGame({
	level: sampleLevel,
	textures: Object.fromEntries(textureEntries),
	sprites: Object.fromEntries(spriteEntries),
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
	if (!locked) openPauseMenu();
});
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

// A click into the game captures the mouse.
canvas.addEventListener("click", () => {
	if (!pauseMenu.isOpen()) mouse.lock();
});
// While the mouse is captured, the browser keeps Esc and releases the mouse (see above).
// Without capture (keyboard-only play), Esc reaches the page and opens the Pause Menu here.
window.addEventListener("keydown", (event) => {
	if (event.code === "Escape" && !mouse.isLocked()) openPauseMenu();
});

const loop = createFixedStepLoop({ ticksPerSecond: TICKS_PER_SECOND });
const framebuffer = createFramebuffer(SCREEN_WIDTH, SCREEN_HEIGHT);
// Shares memory with the framebuffer, so there is no copy per frame.
const image = new ImageData(new Uint8ClampedArray(framebuffer.pixels.buffer), SCREEN_WIDTH, SCREEN_HEIGHT);

const input: InputSnapshot = { forward: 0, strafe: 0, turn: 0, look: 0, shoot: false };
const tick = () => {
	Object.assign(input, keyboard.snapshot());
	// All mouse movement since the last tick goes into this tick, so none is lost or counted twice.
	input.look = mouse.takeLook();
	input.shoot = mouse.takeShot();
	game.step(input);
};
let last: number | undefined;

function frame(now: number): void {
	loop.advance(last === undefined ? 0 : now - last, tick);
	last = now;
	game.render(framebuffer);
	context?.putImageData(image, 0, 0);
	requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

/** Sprite PNGs have no place for the anchor, so the anchors come from sprites/offsets.json. */
async function loadSprites(names: readonly string[]): Promise<(readonly [string, SpriteImage])[]> {
	const response = await fetch(`${freedoom}/sprites/offsets.json`);
	if (!response.ok) throw new Error(`Cannot load sprite offsets: HTTP ${response.status}.`);
	const offsets = (await response.json()) as Record<string, { left: number; top: number } | undefined>;
	return Promise.all(
		names.map(async (name) => {
			const offset = offsets[name];
			if (!offset) throw new Error(`sprites/offsets.json has no anchor for sprite "${name}".`);
			const texture = await loadTexture(`${freedoom}/sprites/${name}.png`);
			return [name, { texture, left: offset.left, top: offset.top }] as const;
		}),
	);
}
