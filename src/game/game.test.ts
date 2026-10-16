import { describe, expect, it } from "vitest";
import { createFramebuffer, type Framebuffer } from "../engine/framebuffer";
import type { InputSnapshot } from "../engine/input";
import { createFixedStepLoop } from "../engine/loop";
import {
	CEILING_COLOR,
	createGame,
	FLOOR_COLOR,
	type Game,
	HUD_VALUE_COLOR,
	SCREEN_HEIGHT,
	SCREEN_WIDTH,
	STATUS_BAR_HEIGHT,
	TICKS_PER_SECOND,
} from "./game";
import sampleLevel from "./levels/sample.json";
import { tiledLevel, tiledRoom } from "./test-support/tiled-level";

const IDLE: InputSnapshot = { forward: 0, strafe: 0, turn: 0 };
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
		const curve: InputSnapshot = { forward: 1, strafe: 0.5, turn: 0.4 };
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
		expect(pixelAt(frame, center, SCREEN_HEIGHT - STATUS_BAR_HEIGHT - 1)).toBe(FLOOR_COLOR);
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

	it("loads the real sample Level", () => {
		const game = createGame({ level: sampleLevel });
		expect(game.state().player).toEqual({ x: 1.5, y: 1.5, angle: 0 });
		expect(game.state().room).toBe("Lobby");
	});
});

describe("Rooms", () => {
	it("puts the player in the Room whose rectangle holds the player start", () => {
		const game = createGame({
			level: tiledLevel({
				rows: ["#######", "#.....#", "#.P...#", "#######"],
				extraObjects: [
					tiledRoom("Lobby", { x: 1, y: 1, width: 3, height: 2 }),
					tiledRoom("Workshop", { x: 4, y: 1, width: 2, height: 2 }),
				],
			}),
		});

		expect(game.state().room).toBe("Lobby");
	});

	it("changes the current Room when the player walks from one Room rectangle into another", () => {
		// Lobby is x 1..4, Workshop is x 4..6. The player starts at x 2.5 and walks east.
		const game = createGame({
			level: tiledLevel({
				rows: ["#######", "#.....#", "#.P...#", "#######"],
				playerAngle: 0,
				extraObjects: [
					tiledRoom("Lobby", { x: 1, y: 1, width: 3, height: 2 }),
					tiledRoom("Workshop", { x: 4, y: 1, width: 2, height: 2 }),
				],
			}),
		});

		// 3 tiles/s: after 20 ticks the player is at x 3.5, still in the Lobby.
		stepTicks(game, FORWARD, 20);
		expect(game.state().room).toBe("Lobby");
		// After 20 more ticks it is at x 4.5, in the Workshop.
		stepTicks(game, FORWARD, 20);
		expect(game.state().room).toBe("Workshop");
	});

	it("keeps the last Room while the player is between Room rectangles", () => {
		// The Lobby ends at x 3 and the Workshop starts at x 4: x 3..4 is a doorway in no Room.
		const game = createGame({
			level: tiledLevel({
				rows: ["#######", "#.....#", "#.P...#", "#######"],
				playerAngle: 0,
				extraObjects: [
					tiledRoom("Lobby", { x: 1, y: 1, width: 2, height: 2 }),
					tiledRoom("Workshop", { x: 4, y: 1, width: 2, height: 2 }),
				],
			}),
		});

		stepTicks(game, FORWARD, 20); // x 3.5
		expect(game.state().room).toBe("Lobby");
	});

	it("has no current Room before the player enters one", () => {
		const game = createGame({ level: tiledLevel({ rows: ["#####", "#P..#", "#####"] }) });
		expect(game.state().room).toBeNull();
	});

	it.each([
		["has no name", tiledRoom("", { x: 1, y: 1, width: 1, height: 1 }), /Room object \d+ has no name/],
		[
			"is a point, not a rectangle",
			{ ...tiledRoom("Lobby", { x: 1, y: 1, width: 0, height: 0 }), point: true },
			/Room "Lobby" must be a rectangle/,
		],
		[
			"is rotated",
			{ ...tiledRoom("Lobby", { x: 1, y: 1, width: 1, height: 1 }), rotation: 45 },
			/Room "Lobby" must not be rotated/,
		],
	])("fails with a clear error when a Room object %s", (_, room, error) => {
		const level = tiledLevel({ rows: ["#####", "#P..#", "#####"], extraObjects: [room] });
		expect(() => createGame({ level })).toThrow(error);
	});

	it("fails with a clear error when two Rooms have the same name", () => {
		const level = tiledLevel({
			rows: ["#####", "#P..#", "#####"],
			extraObjects: [
				tiledRoom("Lobby", { x: 1, y: 1, width: 1, height: 1 }),
				tiledRoom("Lobby", { x: 2, y: 1, width: 1, height: 1 }),
			],
		});
		expect(() => createGame({ level })).toThrow(/Two Rooms are named "Lobby"/);
	});
});

describe("HUD", () => {
	const rows = ["#######", "#.....#", "#.P...#", "#######"];

	function renderAt(rooms: object[], ticksForward = 0): Framebuffer {
		const game = createGame({ level: tiledLevel({ rows, playerAngle: 0, extraObjects: rooms }) });
		stepTicks(game, FORWARD, ticksForward);
		const framebuffer = createFramebuffer(SCREEN_WIDTH, SCREEN_HEIGHT);
		game.render(framebuffer);
		return framebuffer;
	}

	/** The indexes of status bar pixels that have the HUD value color. */
	function valuePixels(frame: Framebuffer): number[] {
		const found: number[] = [];
		for (let i = (SCREEN_HEIGHT - STATUS_BAR_HEIGHT) * SCREEN_WIDTH; i < frame.pixels.length; i++) {
			if (frame.pixels[i] === HUD_VALUE_COLOR) found.push(i);
		}
		return found;
	}

	const lobby = tiledRoom("Lobby", { x: 1, y: 1, width: 3, height: 2 });
	const workshop = tiledRoom("Workshop", { x: 4, y: 1, width: 2, height: 2 });

	it("draws a status bar across the bottom of the frame, below the 3D view", () => {
		const frame = renderAt([lobby]);
		const center = SCREEN_WIDTH / 2;

		expect(STATUS_BAR_HEIGHT).toBeGreaterThan(0);
		expect(STATUS_BAR_HEIGHT).toBeLessThan(SCREEN_HEIGHT / 4);
		for (const y of [SCREEN_HEIGHT - STATUS_BAR_HEIGHT, SCREEN_HEIGHT - 1]) {
			for (const x of [0, center, SCREEN_WIDTH - 1]) {
				const pixel = pixelAt(frame, x, y);
				expect(pixel).not.toBe(FLOOR_COLOR);
				expect(pixel >>> 24).toBe(0xff);
			}
		}
		expect(pixelAt(frame, center, SCREEN_HEIGHT - STATUS_BAR_HEIGHT - 1)).toBe(FLOOR_COLOR);
	});

	it("writes the current Room name in the status bar", () => {
		const inNoRoom = valuePixels(renderAt([]));
		const inLobby = valuePixels(renderAt([lobby, workshop]));
		const inWorkshop = valuePixels(renderAt([lobby, workshop], 40));

		expect(inNoRoom).toEqual([]);
		expect(inLobby.length).toBeGreaterThan(0);
		expect(inWorkshop.length).toBeGreaterThan(0);
		// "Workshop" has more letters than "Lobby", and the two names are drawn differently.
		expect(inWorkshop.length).toBeGreaterThan(inLobby.length);
		expect(inWorkshop).not.toEqual(inLobby);
	});

	it("fails with a clear error when a Room name has a character the HUD cannot draw", () => {
		const level = tiledLevel({ rows, extraObjects: [tiledRoom("Café", { x: 1, y: 1, width: 1, height: 1 })] });
		expect(() => createGame({ level })).toThrow(/Room "Café" has a character the HUD cannot draw: "é"/);
	});
});
