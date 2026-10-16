import { createFramebuffer } from "./engine/framebuffer";
import { createKeyboardInput } from "./engine/input";
import { createFixedStepLoop } from "./engine/loop";
import { loadTexture } from "./engine/texture";
import { createGame, levelTextureNames, SCREEN_HEIGHT, SCREEN_WIDTH, TICKS_PER_SECOND } from "./game/game";
import sampleLevel from "./game/levels/sample.json";

// The browser shell: it owns the canvas, the clock, and the keyboard.
// Everything it does is manual-test only; the Game core has the tests.

const canvas = document.querySelector<HTMLCanvasElement>("#screen");
const context = canvas?.getContext("2d");
if (!canvas || !context) throw new Error("The page has no #screen canvas with a 2D context.");
canvas.width = SCREEN_WIDTH;
canvas.height = SCREEN_HEIGHT;

// Decode every wall texture once, before the first frame. The PNGs are in public/freedoom/.
const textureEntries = await Promise.all(
	levelTextureNames(sampleLevel).map(
		async (name) => [name, await loadTexture(`${import.meta.env.BASE_URL}freedoom/textures/${name}.png`)] as const,
	),
);
const game = createGame({ level: sampleLevel, textures: Object.fromEntries(textureEntries) });
const input = createKeyboardInput(window);
const loop = createFixedStepLoop({ ticksPerSecond: TICKS_PER_SECOND });
const framebuffer = createFramebuffer(SCREEN_WIDTH, SCREEN_HEIGHT);
// Shares memory with the framebuffer, so there is no copy per frame.
const image = new ImageData(new Uint8ClampedArray(framebuffer.pixels.buffer), SCREEN_WIDTH, SCREEN_HEIGHT);

const tick = () => game.step(input.snapshot());
let last: number | undefined;

function frame(now: number): void {
	loop.advance(last === undefined ? 0 : now - last, tick);
	last = now;
	game.render(framebuffer);
	context?.putImageData(image, 0, 0);
	requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
