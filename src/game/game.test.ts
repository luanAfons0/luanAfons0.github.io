import { describe, expect, it } from "vitest";
import { createFramebuffer, type Framebuffer, rgb } from "../engine/framebuffer";
import type { InputSnapshot } from "../engine/input";
import { createFixedStepLoop } from "../engine/loop";
import { createTexture, type Texture } from "../engine/texture";
import {
	CEILING_COLOR,
	createGame,
	FLOOR_COLOR,
	type Game,
	levelTextureNames,
	SCREEN_HEIGHT,
	SCREEN_WIDTH,
	TICKS_PER_SECOND,
} from "./game";
import sampleLevel from "./levels/sample.json";
import { TEST_WALL_TEXTURE, tiledLevel } from "./test-support/tiled-level";

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

	it("loads the real sample Level", () => {
		const game = createGame({ level: sampleLevel });
		expect(game.state().player).toEqual({ x: 1.5, y: 1.5, angle: 0 });
	});
});

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
		const middle = SCREEN_HEIGHT / 2;

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

		const [red, green, blue] = channels(pixelAt(frame, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2));
		expect(green).toBeGreaterThan(0);
		expect(red + blue).toBe(0);
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
