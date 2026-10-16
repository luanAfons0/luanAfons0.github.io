import { describe, expect, it } from "vitest";
import { createFramebuffer, type Framebuffer, rgb } from "../engine/framebuffer";
import type { InputSnapshot } from "../engine/input";
import { createFixedStepLoop } from "../engine/loop";
import { createTexture, type Texture } from "../engine/texture";
import {
	createGame,
	FLOOR_COLOR,
	type Game,
	HUD_VALUE_COLOR,
	levelTextureNames,
	SCREEN_HEIGHT,
	SCREEN_WIDTH,
	STATUS_BAR_HEIGHT,
	TICKS_PER_SECOND,
} from "./game";
import sampleLevel from "./levels/sample.json";
import { TEST_WALL_TEXTURE, tiledLevel, tiledRoom } from "./test-support/tiled-level";

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

const RED = rgb(255, 0, 0);
const GREEN = rgb(0, 255, 0);
const BLUE = rgb(0, 0, 255);
const WHITE = rgb(255, 255, 255);

/** A 4x4 texture with one solid color for each texel column, left to right. */
function columnsTexture(colors: [number, number, number, number]): Texture {
	const rgba = new Uint8Array(4 * 4 * 4);
	new Uint32Array(rgba.buffer).forEach((_, i, texels) => {
		texels[i] = colors[i % 4] as number;
	});
	return createTexture(4, 4, rgba);
}

/** Splits a pixel into its red, green, and blue channels. */
function channels(pixel: number): [number, number, number] {
	return [pixel & 0xff, (pixel >>> 8) & 0xff, (pixel >>> 16) & 0xff];
}

/** A texture of one solid color. */
function solidTexture(color: number): Texture {
	return columnsTexture([color, color, color, color]);
}

/** The ceiling is a gray-blue (red = green < blue) at any shade. */
function isCeiling(pixel: number): boolean {
	const [red, green, blue] = channels(pixel);
	return red === green && blue > red;
}

/** The floor is a brown (red > green > blue) at any shade. */
function isFloor(pixel: number): boolean {
	const [red, green, blue] = channels(pixel);
	return red > green && green > blue;
}

/** The 3D view fills the frame above the status bar; its horizon is in the middle of it. */
const VIEW_HEIGHT = SCREEN_HEIGHT - STATUS_BAR_HEIGHT;
const HORIZON = VIEW_HEIGHT / 2;

/** A corridor that faces a wall at x = 7. The player stands `distance` tiles from it. */
function viewOfWall(distance: number): Framebuffer {
	const game = createGame({
		level: tiledLevel({
			rows: ["#########", "#########", "#P.....##", "#########", "#########"],
			playerOffset: { x: 6 - distance, y: 0.5 },
		}),
		textures: { [TEST_WALL_TEXTURE]: solidTexture(WHITE) },
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
		expect(isCeiling(pixelAt(frame, center, 0))).toBe(true);
		expect(isFloor(pixelAt(frame, center, VIEW_HEIGHT - 1))).toBe(true);
		const wall = pixelAt(frame, center, HORIZON);
		expect(isCeiling(wall) || isFloor(wall)).toBe(false);
		expect(wall >>> 24).toBe(0xff);
	});

	it("draws the same wall darker and shorter farther away", () => {
		const near = viewOfWall(1.5);
		const far = viewOfWall(4.5);
		const center = SCREEN_WIDTH / 2;

		// The wall texture is solid white, so only the shading changes its color.
		const nearWall = pixelAt(near, center, HORIZON);
		const farWall = pixelAt(far, center, HORIZON);
		const [red, green, blue] = channels(nearWall);
		expect(green).toBe(red);
		expect(blue).toBe(red);
		expect(brightness(farWall)).toBeLessThan(brightness(nearWall));
		expect(brightness(nearWall)).toBeLessThan(brightness(WHITE));
		// 60 px above the horizon is still wall up close, but already ceiling far away.
		expect(isCeiling(pixelAt(near, center, HORIZON - 60))).toBe(false);
		expect(isCeiling(pixelAt(far, center, HORIZON - 60))).toBe(true);
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
		expect(isFloor(pixelAt(frame, center, VIEW_HEIGHT - 1))).toBe(true);
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

describe("Textured walls", () => {
	it("draws a wall column with the texture color of the spot the ray hits", () => {
		// The player looks east at the wall face x = 7 from 3 tiles away. The view center hits the
		// middle of the face. Looking east, the texture runs left to right along +y.
		const game = createGame({
			level: tiledLevel({
				rows: ["#########", "#########", "#P.....##", "#########", "#########"],
				playerOffset: { x: 3, y: 0.5 },
			}),
			textures: { [TEST_WALL_TEXTURE]: columnsTexture([RED, GREEN, BLUE, WHITE]) },
		});
		const frame = createFramebuffer(SCREEN_WIDTH, SCREEN_HEIGHT);
		game.render(frame);
		const middle = HORIZON;

		// At 3 tiles, one tile is about 118 px wide, so 20 px is about 0.17 tile.
		const [leftRed, leftGreen, leftBlue] = channels(pixelAt(frame, SCREEN_WIDTH / 2 - 20, middle));
		expect(leftGreen).toBeGreaterThan(0);
		expect(leftRed + leftBlue).toBe(0);
		const [rightRed, rightGreen, rightBlue] = channels(pixelAt(frame, SCREEN_WIDTH / 2 + 20, middle));
		expect(rightBlue).toBeGreaterThan(0);
		expect(rightRed + rightGreen).toBe(0);
	});

	it("gives each Tiled wall tile the texture its tileset names", () => {
		// `#` walls are red; the wall the player faces is an `X` tile, which is green.
		const game = createGame({
			level: tiledLevel({
				rows: ["#####", "#P.X#", "#####"],
				wallTextures: { "#": "RED_WALL", X: "GREEN_WALL" },
			}),
			textures: {
				RED_WALL: columnsTexture([RED, RED, RED, RED]),
				GREEN_WALL: columnsTexture([GREEN, GREEN, GREEN, GREEN]),
			},
		});
		const frame = createFramebuffer(SCREEN_WIDTH, SCREEN_HEIGHT);
		game.render(frame);

		const [red, green, blue] = channels(pixelAt(frame, SCREEN_WIDTH / 2, HORIZON));
		expect(green).toBeGreaterThan(0);
		expect(red + blue).toBe(0);
	});

	it("centers the horizon in the 3D view above the status bar", () => {
		const frame = viewOfWall(3);
		const wallRows: number[] = [];
		for (let y = 0; y < SCREEN_HEIGHT; y++) {
			const [red, green, blue] = channels(pixelAt(frame, SCREEN_WIDTH / 2, y));
			if (red > 0 && red === green && green === blue) wallRows.push(y);
		}
		const top = wallRows[0] as number;
		const bottom = wallRows[wallRows.length - 1] as number;

		// A wall 3 tiles away is about 118 px high, and as many rows above the horizon as below.
		expect(bottom - top + 1).toBeGreaterThan(100);
		expect((top + bottom + 1) / 2).toBeCloseTo(HORIZON, 0);
	});

	it("draws the floor and ceiling as flat colors that get darker toward the horizon", () => {
		// A big open room. The player looks east at a wall 11 tiles away, so the wall is short
		// and most of the view is floor and ceiling.
		const rows = Array.from({ length: 25 }, (_, y) =>
			y === 0 || y === 24 ? "#".repeat(14) : y === 12 ? "#P...........#" : `#${".".repeat(12)}#`,
		);
		const game = createGame({ level: tiledLevel({ rows }), textures: { [TEST_WALL_TEXTURE]: solidTexture(WHITE) } });
		const frame = createFramebuffer(SCREEN_WIDTH, SCREEN_HEIGHT);
		game.render(frame);
		const center = SCREEN_WIDTH / 2;

		for (const y of [0, HORIZON - 20]) {
			expect(isCeiling(pixelAt(frame, center, y))).toBe(true);
			// Flat: one row of ceiling has one color from the left edge to the right edge.
			expect(pixelAt(frame, 0, y)).toBe(pixelAt(frame, center, y));
			expect(pixelAt(frame, SCREEN_WIDTH - 1, y)).toBe(pixelAt(frame, center, y));
		}
		for (const y of [VIEW_HEIGHT - 1, HORIZON + 20]) {
			expect(isFloor(pixelAt(frame, center, y))).toBe(true);
			expect(pixelAt(frame, 0, y)).toBe(pixelAt(frame, center, y));
			expect(pixelAt(frame, SCREEN_WIDTH - 1, y)).toBe(pixelAt(frame, center, y));
		}
		expect(brightness(pixelAt(frame, center, HORIZON - 20))).toBeLessThan(brightness(pixelAt(frame, center, 0)));
		expect(brightness(pixelAt(frame, center, HORIZON + 20))).toBeLessThan(
			brightness(pixelAt(frame, center, VIEW_HEIGHT - 1)),
		);
	});

	it("fails with a clear error when a texture the Level uses is missing", () => {
		const level = tiledLevel({ rows: ["###", "#P#", "###"], wallTextures: { "#": "STARTAN9" } });
		expect(() => createGame({ level, textures: {} })).toThrow(/STARTAN9/);
	});

	it("fails with a clear error when a wall tile has no texture", () => {
		const level = tiledLevel({ rows: ["###", "#P#", "###"] }) as { tilesets: { tiles: unknown[] }[] };
		for (const tileset of level.tilesets) tileset.tiles = [];
		expect(() => createGame({ level })).toThrow(/gid 1 has no "texture" property/);
	});

	it("lists the textures the real sample Level uses, and each one is a committed Freedoom PNG", () => {
		const committed = Object.keys(import.meta.glob("/public/freedoom/textures/*.png"));
		const names = levelTextureNames(sampleLevel);

		expect(names.length).toBeGreaterThan(0);
		for (const name of names) expect(committed).toContain(`/public/freedoom/textures/${name}.png`);
	});
});
