import { describe, expect, it } from "vitest";
import { createFramebuffer, type Framebuffer } from "../engine/framebuffer";
import type { InputSnapshot } from "../engine/input";
import { createFixedStepLoop } from "../engine/loop";
import {
	CEILING_COLOR,
	createGame,
	FLOOR_COLOR,
	type Game,
	SCREEN_HEIGHT,
	SCREEN_WIDTH,
	TICKS_PER_SECOND,
} from "./game";
import sampleLevel from "./levels/sample.json";
import { tiledLevel } from "./test-support/tiled-level";

const IDLE: InputSnapshot = { forward: 0, strafe: 0, turn: 0, look: 0 };
const FORWARD: InputSnapshot = { ...IDLE, forward: 1 };

function stepTicks(game: Game, input: InputSnapshot, ticks: number): void {
	for (let i = 0; i < ticks; i++) game.step(input);
}

/** Pixels are 0xAABBGGRR (little-endian RGBA bytes). */
function brightness(pixel: number): number {
	return (pixel & 0xff) + ((pixel >>> 8) & 0xff) + ((pixel >>> 16) & 0xff);
}

function pixelAt(framebuffer: Framebuffer, x: number, y: number): number {
	return framebuffer.pixels[y * framebuffer.width + x] as number;
}

/** A corridor that faces a wall at x = 7. The player stands `distance` tiles from it. */
function viewOfWall(distance: number): Framebuffer {
	const game = createGame({
		level: tiledLevel({
			rows: ["#########", "#########", "#P.....##", "#########", "#########"],
			playerOffset: { x: 6 - distance, y: 0.5 },
		}),
	});
	const framebuffer = createFramebuffer(SCREEN_WIDTH, SCREEN_HEIGHT);
	game.render(framebuffer);
	return framebuffer;
}

describe("Game core", () => {
	it("starts the player at the Level's player start", () => {
		const game = createGame({
			level: tiledLevel({
				rows: ["#####", "#..P#", "#####"],
				playerAngle: 90,
			}),
		});

		const { player } = game.state();
		expect(player.x).toBeCloseTo(3.5);
		expect(player.y).toBeCloseTo(1.5);
		expect(player.angle).toBeCloseTo(Math.PI / 2);
	});

	it("fails with a clear error when the Level has no player start", () => {
		const level = tiledLevel({ rows: ["###", "#.#", "###"] });
		expect(() => createGame({ level })).toThrow(/player_start/);
	});

	it("stops the player in front of a wall after walking into it for 60 ticks", () => {
		// The wall face is at x = 4. Without the wall, 60 ticks would carry the player past it.
		const game = createGame({
			level: tiledLevel({ rows: ["######", "#P..##", "######"], playerAngle: 0 }),
		});

		stepTicks(game, FORWARD, 60);
		const afterSixty = game.state().player;
		game.step(FORWARD);
		const afterSixtyOne = game.state().player;

		expect(afterSixty.x).toBeLessThan(4);
		expect(afterSixty.x).toBeGreaterThan(3.5);
		expect(afterSixty.y).toBeCloseTo(1.5);
		expect(afterSixtyOne.x).toBeCloseTo(afterSixty.x, 10);
	});

	it("slides the player along a wall when it walks into the wall at an angle", () => {
		// The wall face is at x = 3. The player walks down and to the right at 45 degrees.
		const game = createGame({
			level: tiledLevel({
				rows: ["######", "#P.###", "#..###", "#..###", "#..###", "#..###", "######"],
				playerAngle: 45,
			}),
		});

		stepTicks(game, FORWARD, 60);
		const { player } = game.state();

		// It stops at the wall in x...
		expect(player.x).toBeLessThan(3);
		expect(player.x).toBeGreaterThan(2.5);
		// ...but keeps its full speed along the wall: 3 tiles/s * sin(45°) for 1 s ≈ 2.12 tiles.
		expect(player.y).toBeCloseTo(1.5 + 3 * Math.SQRT1_2, 1);
	});

	it("gives the same position for the same input no matter how ticks are grouped into frames", () => {
		const rows = ["########", "#......#", "#.P....#", "#......#", "#......#", "########"];
		const curve: InputSnapshot = { forward: 1, strafe: 0.5, turn: 0.4, look: 0 };
		const frameGroupings = {
			"60 Hz": Array(60).fill(1000 / 60),
			"144 Hz": Array(144).fill(1000 / 144),
			"20 Hz": Array(20).fill(50),
			uneven: [5, 40, 100, 3, 200, 152, 7, 33, 210, 250],
		};

		const results = Object.entries(frameGroupings).map(([name, frames]) => {
			const game = createGame({ level: tiledLevel({ rows }) });
			const loop = createFixedStepLoop({ ticksPerSecond: TICKS_PER_SECOND });
			let ticks = 0;
			for (const frameMs of frames) {
				ticks += loop.advance(frameMs, () => game.step(curve));
			}
			return { name, ticks, player: game.state().player };
		});

		for (const result of results) {
			expect(result.ticks, result.name).toBe(60);
			expect(result.player, result.name).toEqual(results[0]?.player);
		}
	});

	it("renders a 640x360 frame with ceiling above, floor below, and a wall in the middle", () => {
		const frame = viewOfWall(3);
		const center = SCREEN_WIDTH / 2;

		expect(frame.width).toBe(640);
		expect(frame.height).toBe(360);
		expect(pixelAt(frame, center, 0)).toBe(CEILING_COLOR);
		expect(pixelAt(frame, center, SCREEN_HEIGHT - 1)).toBe(FLOOR_COLOR);
		const wall = pixelAt(frame, center, SCREEN_HEIGHT / 2);
		expect(wall).not.toBe(CEILING_COLOR);
		expect(wall).not.toBe(FLOOR_COLOR);
		expect(wall >>> 24).toBe(0xff);
	});

	it("draws a far wall darker and shorter than a near wall", () => {
		const near = viewOfWall(1.5);
		const far = viewOfWall(4.5);
		const center = SCREEN_WIDTH / 2;
		const middle = SCREEN_HEIGHT / 2;

		expect(brightness(pixelAt(far, center, middle))).toBeLessThan(brightness(pixelAt(near, center, middle)));
		// 60 px above the middle is still wall up close, but already ceiling far away.
		expect(pixelAt(near, center, middle - 60)).not.toBe(CEILING_COLOR);
		expect(pixelAt(far, center, middle - 60)).toBe(CEILING_COLOR);
	});

	it("fails with a clear error when the framebuffer is not 640x360", () => {
		const game = createGame({ level: tiledLevel({ rows: ["###", "#P#", "###"] }) });
		expect(() => game.render(createFramebuffer(320, 200))).toThrow(/640x360/);
	});

	it("does not move or turn the player while paused, and moves again after resume", () => {
		const game = createGame({ level: tiledLevel({ rows: ["#######", "#P....#", "#######"] }) });
		const start = game.state().player;

		game.pause();
		stepTicks(game, { forward: 1, strafe: 1, turn: 1, look: 50 }, 60);

		expect(game.state().paused).toBe(true);
		expect(game.state().player).toEqual(start);

		game.resume();
		stepTicks(game, FORWARD, 10);

		expect(game.state().paused).toBe(false);
		expect(game.state().player.x).toBeGreaterThan(start.x);
	});

	describe("mouse look", () => {
		const rows = ["#####", "#.P.#", "#####"];
		const LOOK_RIGHT: InputSnapshot = { ...IDLE, look: 100 };

		function turnAfterLook(settings?: Parameters<typeof createGame>[0]["settings"]): number {
			const game = createGame({ level: tiledLevel({ rows }), settings });
			const start = game.state().player.angle;
			game.step(LOOK_RIGHT);
			return game.state().player.angle - start;
		}

		it("turns the player right when the mouse moves right", () => {
			expect(turnAfterLook()).toBeGreaterThan(0);
		});

		it("turns twice as far at sensitivity 2 as at sensitivity 1", () => {
			const normal = turnAfterLook({ mouseSensitivity: 1 });
			const doubled = turnAfterLook({ mouseSensitivity: 2 });
			expect(doubled).toBeCloseTo(2 * normal, 10);
		});

		it("turns the other way, by the same amount, when the mouse is inverted", () => {
			const normal = turnAfterLook({ invertMouse: false });
			const inverted = turnAfterLook({ invertMouse: true });
			expect(inverted).toBeCloseTo(-normal, 10);
			expect(inverted).toBeLessThan(0);
		});

		it("uses new settings from the next tick on", () => {
			const game = createGame({ level: tiledLevel({ rows }) });
			game.step(LOOK_RIGHT);
			const normal = game.state().player.angle;

			game.updateSettings({ mouseSensitivity: 0.5, invertMouse: true });
			game.step(LOOK_RIGHT);

			expect(game.state().player.angle - normal).toBeCloseTo(-normal / 2, 10);
		});

		it("does not change how the arrow keys turn", () => {
			const turnWithKeys = (settings: Parameters<typeof createGame>[0]["settings"]) => {
				const game = createGame({ level: tiledLevel({ rows }), settings });
				game.step({ ...IDLE, turn: 1 });
				return game.state().player.angle;
			};
			expect(turnWithKeys({ mouseSensitivity: 3, invertMouse: true })).toBeCloseTo(turnWithKeys({}), 10);
		});
	});

	describe("head bob", () => {
		// The player faces a wall 3.5 tiles away and strafes along it, so the wall keeps
		// the same size. Only head bob can move the wall's top edge on the screen.
		const rows = ["#######", "#P...##", "#....##", "#....##", "#....##", "#....##", "#######"];
		const STRAFE_RIGHT: InputSnapshot = { ...IDLE, strafe: 1 };

		/** The screen row of the wall's top edge in the center column, once per tick. */
		function wallTopRows(game: Game, input: InputSnapshot, ticks: number): Set<number> {
			const framebuffer = createFramebuffer(SCREEN_WIDTH, SCREEN_HEIGHT);
			const rowsSeen = new Set<number>();
			for (let i = 0; i < ticks; i++) {
				game.step(input);
				game.render(framebuffer);
				let y = 0;
				while (pixelAt(framebuffer, SCREEN_WIDTH / 2, y) === CEILING_COLOR) y++;
				rowsSeen.add(y);
			}
			return rowsSeen;
		}

		it("moves the view up and down while the player walks", () => {
			const game = createGame({ level: tiledLevel({ rows }) });
			expect(wallTopRows(game, STRAFE_RIGHT, 30).size).toBeGreaterThan(2);
		});

		it("keeps the view still while the player stands still", () => {
			const game = createGame({ level: tiledLevel({ rows }) });
			expect(wallTopRows(game, IDLE, 30).size).toBe(1);
		});

		it("keeps the view still while walking when reduced motion is on", () => {
			const game = createGame({ level: tiledLevel({ rows }), settings: { reducedMotion: true } });
			expect(wallTopRows(game, STRAFE_RIGHT, 30).size).toBe(1);
		});

		it("stops the bob at once when reduced motion turns on during a walk", () => {
			const game = createGame({ level: tiledLevel({ rows }) });
			wallTopRows(game, STRAFE_RIGHT, 7);
			game.updateSettings({ reducedMotion: true });
			const still = createGame({ level: tiledLevel({ rows }), settings: { reducedMotion: true } });
			expect(wallTopRows(game, STRAFE_RIGHT, 10)).toEqual(wallTopRows(still, IDLE, 1));
		});
	});

	it("loads the real sample Level", () => {
		const game = createGame({ level: sampleLevel });
		expect(game.state().player).toEqual({ x: 1.5, y: 1.5, angle: 0 });
	});
});
