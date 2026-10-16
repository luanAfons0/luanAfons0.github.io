import { describe, expect, it } from "vitest";
import { createFramebuffer } from "../engine/framebuffer";
import { createGame, SCREEN_HEIGHT, SCREEN_WIDTH } from "./game";
import sampleLevel from "./levels/sample.json";

// Renders frames of the real Level through the Game core (Seam 1).
// The 60 FPS target is 16.7 ms per frame. Run it with `pnpm bench` and read the `mean` column.
const FRAME_BUDGET_MS = 1000 / 60;

describe("60 FPS target", () => {
	it("renders a frame of the sample Level inside the frame budget", async ({ bench }) => {
		const game = createGame({ level: sampleLevel });
		const framebuffer = createFramebuffer(SCREEN_WIDTH, SCREEN_HEIGHT);
		const result = await bench("step and render", () => {
			game.step({ forward: 0, strafe: 0, turn: 1 });
			game.render(framebuffer);
		}).run();
		console.log(`mean ${result.latency.mean.toFixed(3)} ms per frame (budget ${FRAME_BUDGET_MS.toFixed(1)} ms)`);
		expect(result.latency.mean).toBeLessThan(FRAME_BUDGET_MS);
	});
});
