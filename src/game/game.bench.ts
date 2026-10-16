import { describe, expect, it } from "vitest";
import { createFramebuffer } from "../engine/framebuffer";
import { createTexture } from "../engine/texture";
import { EXHIBITS } from "./content";
import { createGame, levelTextureNames, SCREEN_HEIGHT, SCREEN_WIDTH } from "./game";
import sampleLevel from "./levels/sample.json";
import { MACHINE_ART_SET } from "./theme";

// Renders frames of the real Level through the Game core (Seam 1).
// The 60 FPS target is 16.7 ms per frame. Run it with `pnpm bench` and read the `mean` column.
const FRAME_BUDGET_MS = 1000 / 60;

describe("60 FPS target", () => {
	it("renders a frame of the sample Level inside the frame budget", async ({ bench }) => {
		// Node cannot decode the PNGs, so each wall gets a noise texture of the usual Freedoom size,
		// and each poster a noise texture of the sample poster size.
		const textures = Object.fromEntries(levelTextureNames(sampleLevel).map((name) => [name, noiseTexture(128, 128)]));
		const posters = Object.fromEntries(EXHIBITS.map(({ id }) => [id, noiseTexture(72, 66)]));
		const game = createGame({ level: sampleLevel, artSet: MACHINE_ART_SET, content: EXHIBITS, textures, posters });
		const framebuffer = createFramebuffer(SCREEN_WIDTH, SCREEN_HEIGHT);
		const result = await bench("step and render", () => {
			game.step({ forward: 0, strafe: 0, turn: 1, look: 0 });
			game.render(framebuffer);
		}).run();
		console.log(`mean ${result.latency.mean.toFixed(3)} ms per frame (budget ${FRAME_BUDGET_MS.toFixed(1)} ms)`);
		expect(result.latency.mean).toBeLessThan(FRAME_BUDGET_MS);
	});
});

function noiseTexture(width: number, height: number) {
	const rgba = new Uint8Array(width * height * 4);
	for (let i = 0; i < rgba.length; i++) rgba[i] = i % 4 === 3 ? 255 : (i * 2654435761) >>> 24;
	return createTexture(width, height, rgba);
}
