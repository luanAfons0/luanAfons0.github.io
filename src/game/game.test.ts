import { describe, expect, it, vi } from "vitest";
import { createFramebuffer, type Framebuffer, rgb } from "../engine/framebuffer";
import type { InputSnapshot } from "../engine/input";
import { createFixedStepLoop } from "../engine/loop";
import { createTexture, type Texture } from "../engine/texture";
import { EXHIBITS } from "./content";
import {
	bugFrameNames,
	createGame,
	type DoorState,
	type Game,
	levelTextureNames,
	SCREEN_HEIGHT,
	SCREEN_WIDTH,
	STATUS_BAR_HEIGHT,
	TICKS_PER_SECOND,
} from "./game";
import sampleLevel from "./levels/sample.json";
import {
	TEST_DOOR_TEXTURE,
	TEST_TRACK_TEXTURE,
	TEST_WALL_TEXTURE,
	tiledBug,
	tiledExhibit,
	tiledLevel,
	tiledRoom,
} from "./test-support/tiled-level";
import {
	type ArtSet,
	artSetOf,
	DUNGEON_ART_SET,
	MACHINE_ART_SET,
	posterPath,
	SOUND_EVENTS,
	TEXTURE_ROLES,
	THEMES,
} from "./theme";

const IDLE: InputSnapshot = { forward: 0, strafe: 0, turn: 0, look: 0 };
const FORWARD: InputSnapshot = { ...IDLE, forward: 1 };
const USE: InputSnapshot = { ...IDLE, use: true };

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

/** Width over height of the box around some pixel indexes of a full-size frame. */
function aspect(indexes: number[]): number {
	const xs = indexes.map((i) => i % SCREEN_WIDTH);
	const ys = indexes.map((i) => Math.floor(i / SCREEN_WIDTH));
	return (Math.max(...xs) - Math.min(...xs) + 1) / (Math.max(...ys) - Math.min(...ys) + 1);
}

/** The HUD colors of the machine art set, which the Game core uses by default. */
const HUD_VALUE_COLOR = rgb(...MACHINE_ART_SET.hud.value);
const CROSSHAIR_COLOR = rgb(...MACHINE_ART_SET.hud.crosshair);
const FLOOR_COLOR = rgb(...MACHINE_ART_SET.floor);

const RED = rgb(255, 0, 0);
const GREEN = rgb(0, 255, 0);
const BLUE = rgb(0, 0, 255);
const WHITE = rgb(255, 255, 255);

/** A texture 4 texels wide (4 high by default) with one solid color for each texel column, left to right. */
function columnsTexture(colors: [number, number, number, number], height = 4): Texture {
	const rgba = new Uint8Array(4 * height * 4);
	new Uint32Array(rgba.buffer).forEach((_, i, texels) => {
		texels[i] = colors[i % 4] as number;
	});
	return createTexture(4, height, rgba);
}

/** Splits a pixel into its red, green, and blue channels. */
function channels(pixel: number): [number, number, number] {
	return [pixel & 0xff, (pixel >>> 8) & 0xff, (pixel >>> 16) & 0xff];
}

/** A texture of one solid color. */
function solidTexture(color: number): Texture {
	return columnsTexture([color, color, color, color]);
}

/** Every shade the renderer can give a flat color: each channel scaled by the same light level (0 to 256). */
function shadesOf([red, green, blue]: readonly [number, number, number]): Set<number> {
	const shades = new Set<number>();
	for (let level = 0; level <= 256; level++) {
		shades.add(rgb((red * level) >> 8, (green * level) >> 8, (blue * level) >> 8));
	}
	return shades;
}

/** The decoded Flats of an art set, keyed by file name as the browser shell loads them: each one solid color. */
function flatTexturesOf(artSet: ArtSet, color: number): Record<string, Texture> {
	if (!artSet.flats) return {};
	return { [artSet.flats.ceiling]: solidTexture(color), [artSet.flats.floor]: solidTexture(color) };
}

const CEILING_SHADES = shadesOf(MACHINE_ART_SET.ceiling);
const FLOOR_SHADES = shadesOf(MACHINE_ART_SET.floor);

/** The ceiling is the art set's ceiling color at any shade. */
function isCeiling(pixel: number): boolean {
	return CEILING_SHADES.has(pixel);
}

/** The floor is the art set's floor color at any shade. */
function isFloor(pixel: number): boolean {
	return FLOOR_SHADES.has(pixel);
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
				while (isCeiling(pixelAt(framebuffer, SCREEN_WIDTH / 2, y))) y++;
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
		const game = createGame({ level: sampleLevel, content: EXHIBITS });
		expect(game.state().player).toEqual({ x: 1.5, y: 1.5, angle: 0 });
		expect(game.state().room).toBe("Lobby");
	});

	it("spreads several Bugs over every Room of the real sample Level", () => {
		const { bugs, bugsTotal } = createGame({ level: sampleLevel, content: EXHIBITS }).state();
		expect(bugsTotal).toBeGreaterThanOrEqual(5);
		expect(new Set(bugs.map((bug) => bug.room))).toEqual(new Set(["Lobby", "Workshop", "Archive"]));
	});
});

describe("Art set", () => {
	const bugRoom = tiledRoom("Lobby", { x: 1, y: 1, width: 3, height: 1 });
	const bugLevel = tiledLevel({
		rows: ["#####", "#P..#", "#####"],
		wallTextures: { "#": "wall-a" },
		extraObjects: [bugRoom, tiledBug({ x: 3.5, y: 1.5 })],
	});

	/** The machine art set with no entry for one key of a map, as a broken art set would have. */
	function without<K extends "textures" | "sounds">(key: K, missing: string): ArtSet {
		const map = Object.fromEntries(Object.entries(MACHINE_ART_SET[key]).filter(([name]) => name !== missing));
		return { ...MACHINE_ART_SET, [key]: map };
	}

	it.each(THEMES)("creates the Game core with the real sample Level and the art set of the %s Theme", (theme) => {
		const artSet = artSetOf(theme);
		const image = { texture: solidTexture(GREEN), left: 2, top: 4 };
		const sprites = Object.fromEntries(bugFrameNames(artSet).map((name) => [name, image]));
		const posters = Object.fromEntries(EXHIBITS.map(({ id }) => [id, solidTexture(GREEN)]));

		const game = createGame({ level: sampleLevel, content: EXHIBITS, artSet, sprites, posters });

		expect(game.state().room).toBe("Lobby");
	});

	it("maps Paper and Board (and no saved Theme) to the machine art set, and Dungeon to the dungeon art set", () => {
		expect(artSetOf("paper")).toBe(MACHINE_ART_SET);
		expect(artSetOf("board")).toBe(MACHINE_ART_SET);
		expect(artSetOf(undefined)).toBe(MACHINE_ART_SET);
		expect(artSetOf("dungeon")).toBe(DUNGEON_ART_SET);
		expect(DUNGEON_ART_SET.name).toBe("dungeon");
	});

	it("has the real sample Level name texture roles only", () => {
		const names = levelTextureNames(sampleLevel);

		expect(names.length).toBeGreaterThan(0);
		for (const name of names) expect(TEXTURE_ROLES).toContain(name);
	});

	it("maps every texture role of the machine art set to its machine file", () => {
		expect(MACHINE_ART_SET.textures).toEqual({
			"wall-a": "board-a",
			"wall-b": "board-b",
			feature: "chip",
			storage: "rack",
			door: "door",
			"door-track": "door-track",
		});
	});

	it("fails with an error that names a wall texture that is not a texture role", () => {
		const level = tiledLevel({ rows: ["###", "#P#", "###"], wallTextures: { "#": "board-a" } });
		expect(() => createGame({ level, artSet: MACHINE_ART_SET })).toThrow(/texture "board-a".*not a texture role/);
	});

	it("fails with an error that names a door texture that is not a texture role", () => {
		const level = tiledLevel({
			rows: ["######", "#P.D.#", "######"],
			wallTextures: { "#": "wall-a" },
			doorTiles: { D: { texture: "NOSUCHDOOR", track: "door-track" } },
		});
		expect(() => createGame({ level, artSet: MACHINE_ART_SET })).toThrow(/texture "NOSUCHDOOR".*not a texture role/);
	});

	it("fails with an error that names the art set and the texture role it has no file for", () => {
		const level = tiledLevel({ rows: ["###", "#P#", "###"], wallTextures: { "#": "wall-a" } });
		expect(() => createGame({ level, artSet: without("textures", "storage") })).toThrow(
			/art set "machine".*texture role "storage"/i,
		);
	});

	it("fails with an error that names the art set and the sound event it has no sound for", () => {
		const level = tiledLevel({ rows: ["###", "#P#", "###"], wallTextures: { "#": "wall-a" } });
		expect(() => createGame({ level, artSet: without("sounds", "door-open") })).toThrow(
			/art set "machine".*sound event "door-open"/i,
		);
	});

	it("fails with an error that names the missing Bug walk frame when the Level has Bugs", () => {
		const artSet = { ...MACHINE_ART_SET, bugWalkFrames: [] };
		expect(() => createGame({ level: bugLevel, artSet })).toThrow(/Bug walk frame/);
	});

	it("fails with an error that names the missing Bug fix frame when the Level has Bugs", () => {
		const artSet = { ...MACHINE_ART_SET, bugFixFrames: [] };
		expect(() => createGame({ level: bugLevel, artSet })).toThrow(/Bug fix frame/);
	});

	it("loads the Bug frames the art set names, and names the art set and the frame it has no image for", () => {
		const artSet = { ...MACHINE_ART_SET, bugWalkFrames: ["BEETLE1"], bugFixFrames: ["PATCHED1"] };
		const image = { texture: solidTexture(GREEN), left: 2, top: 4 };
		expect(() => createGame({ level: bugLevel, artSet, sprites: { BEETLE1: image } })).toThrow(
			/art set "machine".*Bug frame "PATCHED1"/i,
		);
		expect(() => createGame({ level: bugLevel, artSet, sprites: { BEETLE1: image, PATCHED1: image } })).not.toThrow();
	});

	it("names each Bug frame once, so the browser shell loads a held frame once", () => {
		const artSet = { ...MACHINE_ART_SET, bugWalkFrames: ["W1", "W2"], bugFixFrames: ["F1", "DONE", "DONE"] };
		expect(bugFrameNames(artSet)).toEqual(["W1", "W2", "F1", "DONE"]);
	});

	it.each([MACHINE_ART_SET, DUNGEON_ART_SET])(
		"names only committed files in the $name art set: textures, Flats, Bug frames with anchors, posters, and sounds",
		(artSet) => {
			const committed = Object.keys(import.meta.glob(["/public/**/*.png", "/public/**/*.wav", "/public/**/*.json"]));
			const { folders } = artSet;
			const allOffsets = import.meta.glob<Record<string, unknown>>("/public/**/offsets.json", {
				eager: true,
				import: "default",
			});
			const offsets = allOffsets[`/public/${folders.sprites}/offsets.json`] ?? {};

			for (const role of TEXTURE_ROLES) {
				expect(committed).toContain(`/public/${folders.textures}/${artSet.textures[role]}.png`);
			}
			for (const flat of Object.values(artSet.flats ?? {})) {
				expect(committed).toContain(`/public/${folders.textures}/${flat}.png`);
			}
			for (const name of bugFrameNames(artSet)) {
				expect(committed).toContain(`/public/${folders.sprites}/${name}.png`);
				expect(offsets[name]).toEqual({ left: expect.any(Number), top: expect.any(Number) });
			}
			for (const { id } of EXHIBITS) expect(committed).toContain(`/public/${posterPath(artSet, id)}`);
			for (const event of SOUND_EVENTS) {
				expect(committed).toContain(`/public/${folders.sounds}/${artSet.sounds[event]}.wav`);
			}
		},
	);

	describe("change during play", () => {
		const SHOOT: InputSnapshot = { ...IDLE, shoot: true };
		const exhibitId = (EXHIBITS[0] as (typeof EXHIBITS)[number]).id;
		// A corridor: the player starts at x 1.5 and faces east. A Bug stays in a closet at x 2.5, a
		// door is the cell x 3, and the end wall (x 8) has an Exhibit.
		const corridor = tiledLevel({
			rows: ["#########", "#P.D....#", "#########"],
			wallTextures: { "#": "wall-a" },
			doorTiles: { D: { texture: "door", track: "door-track" } },
			extraObjects: [
				tiledRoom("Lobby", { x: 1, y: 1, width: 7, height: 1 }),
				tiledRoom("Closet", { x: 2.4, y: 1.4, width: 0.2, height: 0.2 }),
				tiledBug({ x: 2.5, y: 1.5 }),
				tiledExhibit(exhibitId, { x: 8, y: 1 }, "west"),
			],
		});
		const content = EXHIBITS.filter(({ id }) => id === exhibitId);

		/** A Bug-sized sprite of one color, anchored at its bottom middle. */
		function spriteOf(color: number) {
			const rgba = new Uint8Array(30 * 39 * 4);
			new Uint32Array(rgba.buffer).fill(color);
			return { texture: createTexture(30, 39, rgba), left: 15, top: 35 };
		}

		/**
		 * The decoded art of an art set: every texture and poster in one color, every Bug frame in
		 * another, and the Flats (if the art set has them) white.
		 */
		function artOf(artSet: ArtSet, wall: number, bug: number) {
			return {
				artSet,
				textures: {
					...Object.fromEntries(TEXTURE_ROLES.map((role) => [role, solidTexture(wall)])),
					...flatTexturesOf(artSet, WHITE),
				},
				sprites: Object.fromEntries(bugFrameNames(artSet).map((name) => [name, spriteOf(bug)])),
				posters: Object.fromEntries(EXHIBITS.map(({ id }) => [id, solidTexture(wall)])),
			};
		}

		/** The color channels a pixel lights, as "r", "g", and "b". */
		function lit(pixel: number): string {
			return channels(pixel)
				.map((value, i) => (value > 0 ? "rgb"[i] : ""))
				.join("");
		}

		function render(game: Game): Framebuffer {
			const frame = createFramebuffer(SCREEN_WIDTH, SCREEN_HEIGHT);
			game.render(frame);
			return frame;
		}

		/** Fixes the Bug, opens the door, walks to the end wall, and opens its Exhibit. */
		function play(game: Game): void {
			game.step(SHOOT);
			stepTicks(game, FORWARD, 30);
			game.step(USE);
			stepTicks(game, IDLE, 60);
			for (let tick = 0; tick < 300 && game.state().exhibitInFocus === null; tick++) game.step(FORWARD);
			game.step(USE);
		}

		it("keeps the player, the Bugs fixed, the doors, and the open Exhibit", () => {
			const game = createGame({ level: corridor, content, ...artOf(MACHINE_ART_SET, RED, BLUE) });
			play(game);
			const before = game.state();
			expect(before).toMatchObject({ bugsFixed: 1, openExhibit: exhibitId, paused: true });
			expect(before.doors[0]?.state).toBe("open");

			game.changeArtSet(artOf(DUNGEON_ART_SET, GREEN, WHITE));

			expect(game.state()).toEqual(before);
			game.closeExhibit();
			game.step(IDLE);
			expect(game.state().paused).toBe(false);
		});

		it("draws the walls, the Bug frames, and the floor of the new art set", () => {
			const game = createGame({ level: corridor, content, ...artOf(MACHINE_ART_SET, RED, BLUE) });
			const wall = { x: SCREEN_WIDTH / 2 + 200, y: HORIZON - 40 };
			const floor = { x: SCREEN_WIDTH / 2, y: VIEW_HEIGHT - 2 };
			const machine = render(game);
			expect(lit(pixelAt(machine, SCREEN_WIDTH / 2, HORIZON))).toBe("b");
			expect(lit(pixelAt(machine, wall.x, wall.y))).toBe("r");
			expect(shadesOf([255, 255, 255]).has(pixelAt(machine, floor.x, floor.y))).toBe(true);

			game.changeArtSet(artOf(DUNGEON_ART_SET, GREEN, RED));

			const dungeon = render(game);
			expect(lit(pixelAt(dungeon, SCREEN_WIDTH / 2, HORIZON))).toBe("r");
			expect(lit(pixelAt(dungeon, wall.x, wall.y))).toBe("g");
			expect(shadesOf(DUNGEON_ART_SET.floor).has(pixelAt(dungeon, floor.x, floor.y))).toBe(true);
			// The status bar is filled with the bar color of the art set.
			const barPixels = (frame: Framebuffer, artSet: ArtSet) =>
				frame.pixels.subarray(VIEW_HEIGHT * SCREEN_WIDTH).filter((pixel) => pixel === rgb(...artSet.hud.bar)).length;
			expect(barPixels(machine, MACHINE_ART_SET)).toBeGreaterThan(SCREEN_WIDTH * 10);
			expect(barPixels(dungeon, DUNGEON_ART_SET)).toBeGreaterThan(SCREEN_WIDTH * 10);
			expect(barPixels(dungeon, MACHINE_ART_SET)).toBe(0);
		});

		it.each([
			["a texture role", { artSet: without("textures", "storage") }, /art set "machine".*texture role "storage"/i],
			["a sound event", { artSet: without("sounds", "shot") }, /art set "machine".*sound event "shot"/i],
			["a Bug frame image", { sprites: {} }, /art set "dungeon".*Bug frame/i],
			["a poster", { posters: {} }, /art set "dungeon".*poster image for Exhibit/i],
			["a texture the Level uses", { textures: {} }, /texture "wall-a"/],
		])("fails on an art set with no %s, and keeps the old art set", (_, broken, error) => {
			const game = createGame({ level: corridor, content, ...artOf(MACHINE_ART_SET, RED, BLUE) });
			play(game);
			const before = game.state();
			const machine = render(game);

			expect(() => game.changeArtSet({ ...artOf(DUNGEON_ART_SET, GREEN, WHITE), ...broken })).toThrow(error);

			expect(game.state()).toEqual(before);
			expect(render(game).pixels).toEqual(machine.pixels);
		});
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
		// The HUD font has 5x7 glyphs with a 1-pixel gap, at any scale. A name of n glyphs whose first
		// and last glyphs touch their outer edges spans 6n - 1 font pixels across and 7 down.
		const inNoRoom = valuePixels(renderAt([]));
		const inLobby = valuePixels(renderAt([lobby, workshop]));
		const inWorkshop = valuePixels(renderAt([lobby, workshop], 40));

		expect(inNoRoom).toEqual([]);
		expect(aspect(inLobby)).toBeCloseTo((6 * 5 - 1) / 7);
		expect(aspect(inWorkshop)).toBeCloseTo((6 * 8 - 1) / 7);
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

	it("draws each column of a far wall in one texture column, up to its top pixel", () => {
		// Each texel column of the wall texture has its own color, so a column that shows two colors
		// (or black) read a texel outside its texture column. A tall texture on a short far wall
		// makes the first texture row of a column easy to miss.
		const rows = ["#".repeat(40), `#P${".".repeat(36)}##`, "#".repeat(40)];
		const texture = columnsTexture([RED, GREEN, BLUE, WHITE], 128);
		const frame = createFramebuffer(SCREEN_WIDTH, SCREEN_HEIGHT);
		const mixed: string[] = [];

		for (let distance = 6; distance < 30; distance += 0.37) {
			const level = tiledLevel({ rows, playerOffset: { x: 37 - distance, y: 0.5 } });
			createGame({ level, textures: { [TEST_WALL_TEXTURE]: texture } }).render(frame);
			for (let x = 0; x < SCREEN_WIDTH; x++) {
				const colors = new Set<number>();
				for (let y = 0; y < VIEW_HEIGHT; y++) {
					const pixel = pixelAt(frame, x, y);
					if (!isCeiling(pixel) && !isFloor(pixel) && pixel !== CROSSHAIR_COLOR) colors.add(pixel);
				}
				if (colors.size > 1) mixed.push(`distance ${distance.toFixed(2)}, column ${x}`);
			}
		}

		expect(mixed).toEqual([]);
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
});

describe("Flats", () => {
	// A big open room. The player looks east at a wall 11 tiles away, so the wall is short
	// and most of the view is floor and ceiling.
	const room = Array.from({ length: 25 }, (_, y) =>
		y === 0 || y === 24 ? "#".repeat(14) : y === 12 ? "#P...........#" : `#${".".repeat(12)}#`,
	);
	const FLAT_ART_SET: ArtSet = { ...MACHINE_ART_SET, flats: { ceiling: "TEST_CEILING", floor: "TEST_FLOOR" } };

	/** A Game core in the open room with the given Flats, and white walls. */
	function flatGame(ceiling: Texture, floor: Texture, options: Partial<Parameters<typeof createGame>[0]> = {}): Game {
		return createGame({
			level: tiledLevel({ rows: room, wallTextures: { "#": "wall-a" } }),
			artSet: FLAT_ART_SET,
			textures: { "wall-a": solidTexture(WHITE), TEST_CEILING: ceiling, TEST_FLOOR: floor },
			...options,
		});
	}

	function render(game: Game): Framebuffer {
		const frame = createFramebuffer(SCREEN_WIDTH, SCREEN_HEIGHT);
		game.render(frame);
		return frame;
	}

	it("draws the ceiling Flat and the floor Flat at the shade of their distance", () => {
		const frame = render(flatGame(solidTexture(RED), solidTexture(GREEN)));

		// The top and bottom rows of the view are 159.5 rows from the horizon. The eye is half a
		// tile above the floor, so they show the floor and the ceiling 1.11 tiles away, where the
		// light is 1 - 1.11 / 12 (232 / 256): 255 shades to 231.
		for (const x of [0, SCREEN_WIDTH / 2, SCREEN_WIDTH - 1]) {
			expect(pixelAt(frame, x, 0)).toBe(rgb(231, 0, 0));
			expect(pixelAt(frame, x, VIEW_HEIGHT - 1)).toBe(rgb(0, 231, 0));
		}
	});

	it("keeps the floor Flat fixed to the world when the player walks and turns", () => {
		// Each quarter of a tile has its own color: red in the north-west, green in the north-east,
		// blue in the south-west, and white in the south-east (y grows to the south).
		const rgba = new Uint8Array(new Uint32Array([RED, GREEN, BLUE, WHITE]).buffer);
		const quarters = createTexture(2, 2, rgba);
		const game = flatGame(solidTexture(RED), quarters, { settings: { reducedMotion: true } });
		// The bottom row of the view shows the floor 1.11 tiles ahead (see the test above), at light 231.
		const AHEAD = 1.115;
		const SHADED = { red: rgb(231, 0, 0), green: rgb(0, 231, 0), blue: rgb(0, 0, 231), white: rgb(231, 231, 231) };
		const quarterAt = (x: number, y: number) => {
			const east = x - Math.floor(x) >= 0.5;
			const south = y - Math.floor(y) >= 0.5;
			if (south) return east ? SHADED.white : SHADED.blue;
			return east ? SHADED.green : SHADED.red;
		};
		/** True when a point is too near the line between two quarters to say which one it is in. */
		const onEdge = (value: number) => Math.abs(((value * 2) % 1) - 0.5) > 0.45;
		const TURN: InputSnapshot = { ...IDLE, turn: 1 };
		let checked = 0;

		for (let tick = 0; tick < 90; tick++) {
			game.step(tick % 3 === 0 ? TURN : FORWARD);
			const { x, y, angle } = game.state().player;
			const floorX = x + AHEAD * Math.cos(angle);
			const floorY = y + AHEAD * Math.sin(angle);
			if (onEdge(floorX) || onEdge(floorY)) continue;
			expect(pixelAt(render(game), SCREEN_WIDTH / 2, VIEW_HEIGHT - 1)).toBe(quarterAt(floorX, floorY));
			checked++;
		}

		expect(checked).toBeGreaterThan(40);
	});

	it("draws a far row of a Flat darker than a near row", () => {
		const frame = render(flatGame(solidTexture(RED), solidTexture(GREEN)));
		const [, far] = channels(pixelAt(frame, SCREEN_WIDTH / 2, HORIZON + 30));
		const [, near] = channels(pixelAt(frame, SCREEN_WIDTH / 2, VIEW_HEIGHT - 1));
		const [farCeiling] = channels(pixelAt(frame, SCREEN_WIDTH / 2, HORIZON - 30));
		const [nearCeiling] = channels(pixelAt(frame, SCREEN_WIDTH / 2, 0));

		expect(far).toBeGreaterThan(0);
		expect(far).toBeLessThan(near);
		expect(farCeiling).toBeGreaterThan(0);
		expect(farCeiling).toBeLessThan(nearCeiling);
	});

	describe("horizon", () => {
		const STRAFE_RIGHT: InputSnapshot = { ...IDLE, strafe: 1 };
		const SHOOT: InputSnapshot = { ...IDLE, shoot: true };

		/**
		 * The colors of a floor row and a ceiling row 30 rows from the horizon, once per tick. The wall
		 * 11 tiles away is only 32 rows high, so they always show the Flats. A row nearer the horizon
		 * shows the Flat farther away and darker, so a new color means the Flat rows moved.
		 */
		function flatRowColors(game: Game, first: InputSnapshot, then: InputSnapshot, ticks: number) {
			const floor = new Set<number>();
			const ceiling = new Set<number>();
			game.step(first);
			for (let tick = 0; tick < ticks; tick++) {
				const frame = render(game);
				floor.add(pixelAt(frame, SCREEN_WIDTH / 2, HORIZON + 30));
				ceiling.add(pixelAt(frame, SCREEN_WIDTH / 2, HORIZON - 30));
				game.step(then);
			}
			for (const pixel of floor) expect(shadesOf([0, 255, 0]).has(pixel)).toBe(true);
			for (const pixel of ceiling) expect(shadesOf([255, 0, 0]).has(pixel)).toBe(true);
			return { floor: floor.size, ceiling: ceiling.size };
		}

		it("moves the Flat rows with the head bob, and keeps them still with reduced motion on", () => {
			const bob = flatRowColors(flatGame(solidTexture(RED), solidTexture(GREEN)), STRAFE_RIGHT, STRAFE_RIGHT, 30);
			const still = flatRowColors(
				flatGame(solidTexture(RED), solidTexture(GREEN), { settings: { reducedMotion: true } }),
				STRAFE_RIGHT,
				STRAFE_RIGHT,
				30,
			);

			expect(bob.floor).toBeGreaterThan(2);
			expect(bob.ceiling).toBeGreaterThan(2);
			expect(still).toEqual({ floor: 1, ceiling: 1 });
		});

		it("moves the Flat rows with the shake after a shot, and keeps them still with reduced motion on", () => {
			const shake = flatRowColors(flatGame(solidTexture(RED), solidTexture(GREEN)), SHOOT, IDLE, 20);
			const still = flatRowColors(
				flatGame(solidTexture(RED), solidTexture(GREEN), { settings: { reducedMotion: true } }),
				SHOOT,
				IDLE,
				20,
			);

			expect(shake.floor).toBeGreaterThan(1);
			expect(shake.ceiling).toBeGreaterThan(1);
			expect(still).toEqual({ floor: 1, ceiling: 1 });
		});
	});

	it.each(["ceiling", "floor"] as const)(
		"fails with an error that names the art set and the %s Flat when its file is not in the textures",
		(surface) => {
			const name = surface === "ceiling" ? "TEST_CEILING" : "TEST_FLOOR";
			const textures = {
				"wall-a": solidTexture(WHITE),
				TEST_CEILING: solidTexture(RED),
				TEST_FLOOR: solidTexture(GREEN),
			};
			const { [name]: _, ...withoutFlat } = textures;
			const error = new RegExp(`art set "machine".*${surface} Flat "${name}"`, "i");

			expect(() => flatGame(solidTexture(RED), solidTexture(GREEN), { textures: withoutFlat })).toThrow(error);

			const game = flatGame(solidTexture(RED), solidTexture(GREEN));
			const before = render(game);
			expect(() => game.changeArtSet({ artSet: FLAT_ART_SET, textures: withoutFlat })).toThrow(error);
			expect(render(game).pixels).toEqual(before.pixels);
		},
	);

	it("draws the flat colors of an art set with no Flats", () => {
		const { flats: _, ...noFlats } = FLAT_ART_SET;
		const frame = render(flatGame(solidTexture(RED), solidTexture(GREEN), { artSet: noFlats }));

		expect(isCeiling(pixelAt(frame, SCREEN_WIDTH / 2, 0))).toBe(true);
		expect(isFloor(pixelAt(frame, SCREEN_WIDTH / 2, VIEW_HEIGHT - 1))).toBe(true);
	});
});

describe("Bugs", () => {
	// One Room, 9 tiles wide. The player starts at the west end and faces east.
	const rows = ["###########", "#P........#", "#.........#", "#.........#", "###########"];
	const room = tiledRoom("Lobby", { x: 1, y: 1, width: 9, height: 3 });

	function bugLevel(
		bugs: { x: number; y: number }[],
		options: { rows?: string[]; rooms?: object[]; wall?: string } = {},
	) {
		return tiledLevel({
			rows: options.rows ?? rows,
			wallTextures: { "#": options.wall ?? TEST_WALL_TEXTURE },
			playerAngle: 0,
			extraObjects: [...(options.rooms ?? [room]), ...bugs.map(tiledBug)],
		});
	}

	it.each([
		["is in no Room", { x: 5.5, y: 1.5 }, [], /Bug object \d+ is in no Room/],
		["is inside a wall", { x: 4.5, y: 1.5 }, [room], /Bug object \d+ is inside a wall/],
	])("fails with a clear error when a Bug spawn %s", (_, bug, rooms, error) => {
		const walled = ["###########", "#P..#.....#", "#.........#", "#.........#", "###########"];
		expect(() => createGame({ level: bugLevel([bug], { rows: walled, rooms }) })).toThrow(error);
	});

	it("reads the Bug spawns from the Level, and no Bug is fixed at the start", () => {
		const game = createGame({
			level: bugLevel([
				{ x: 5.5, y: 1.5 },
				{ x: 7.5, y: 3.5 },
			]),
		});

		const state = game.state();
		expect(state.bugsTotal).toBe(2);
		expect(state.bugsFixed).toBe(0);
		expect(state.goalComplete).toBe(false);
		expect(state.bugs.map(({ x, y, room }) => ({ x, y, room }))).toEqual([
			{ x: 5.5, y: 1.5, room: "Lobby" },
			{ x: 7.5, y: 3.5, room: "Lobby" },
		]);
	});

	const SHOOT: InputSnapshot = { ...IDLE, shoot: true };

	it("fixes a Bug when the player shoots at it", () => {
		const game = createGame({ level: bugLevel([{ x: 6.5, y: 1.5 }]) });

		game.step(SHOOT);

		expect(game.state().bugsFixed).toBe(1);
		expect(game.state().bugs[0]?.fixed).toBe(true);
	});

	it("fixes no Bug when the shot misses", () => {
		const game = createGame({ level: bugLevel([{ x: 6.5, y: 3.5 }]) });

		game.step(SHOOT);

		expect(game.state().bugsFixed).toBe(0);
	});

	it("fixes only the nearest Bug when two Bugs are in the line of fire", () => {
		const game = createGame({
			level: bugLevel([
				{ x: 8.5, y: 1.5 },
				{ x: 4.5, y: 1.5 },
			]),
		});

		game.step(SHOOT);

		expect(game.state().bugsFixed).toBe(1);
		expect(game.state().bugs.map((bug) => bug.fixed)).toEqual([false, true]);
	});

	it("does not fix a Bug behind a wall", () => {
		// A wall at x = 4 stands between the player and the Bug.
		const walled = ["###########", "#P..#.....#", "#.........#", "#.........#", "###########"];
		const game = createGame({ level: bugLevel([{ x: 6.5, y: 1.5 }], { rows: walled }) });

		game.step(SHOOT);

		expect(game.state().bugsFixed).toBe(0);
	});

	it("shoots once per shot input, not on the ticks without one", () => {
		const game = createGame({
			level: bugLevel([
				{ x: 4.5, y: 1.5 },
				{ x: 7.5, y: 1.5 },
			]),
		});

		game.step(SHOOT);
		stepTicks(game, IDLE, 5);

		expect(game.state().bugsFixed).toBe(1);
	});

	it("completes the goal when the player fixes every Bug, and fixed Bugs stay fixed", () => {
		// One Bug east of the player, one south of it.
		const game = createGame({
			level: bugLevel([
				{ x: 6.5, y: 1.5 },
				{ x: 1.5, y: 3.5 },
			]),
		});

		game.step(SHOOT);
		expect(game.state().goalComplete).toBe(false);
		// A quarter turn to the right faces south (+y).
		stepTicks(game, { ...IDLE, turn: 1 }, TICKS_PER_SECOND / 2);
		game.step(SHOOT);

		expect(game.state().bugsFixed).toBe(2);
		expect(game.state().goalComplete).toBe(true);
		stepTicks(game, SHOOT, 10 * TICKS_PER_SECOND);
		expect(game.state().bugsFixed).toBe(2);
		expect(game.state().bugs.every((bug) => bug.fixed)).toBe(true);
		expect(game.state().goalComplete).toBe(true);
	});

	it("sends all-bugs-fixed once, when the goal becomes complete", () => {
		const track = vi.fn();
		const game = createGame({
			level: bugLevel([
				{ x: 6.5, y: 1.5 },
				{ x: 1.5, y: 3.5 },
			]),
			track,
		});

		game.step(SHOOT);
		expect(track).not.toHaveBeenCalled();
		stepTicks(game, { ...IDLE, turn: 1 }, TICKS_PER_SECOND / 2);
		game.step(SHOOT);
		stepTicks(game, SHOOT, 3 * TICKS_PER_SECOND);

		expect(track).toHaveBeenCalledExactlyOnceWith("all-bugs-fixed");
	});

	it("has no goal to complete in a Level with no Bugs", () => {
		const game = createGame({ level: bugLevel([]) });
		expect(game.state().bugsTotal).toBe(0);
		expect(game.state().goalComplete).toBe(false);
	});

	describe("walking", () => {
		// Two Rooms side by side with an open doorway between them: the Lab (x 1..4) and the Hall (x 4..10).
		const open = ["###########", "#.........#", "#.........#", "#P........#", "###########"];
		const lab = tiledRoom("Lab", { x: 1, y: 1, width: 3, height: 3 });
		const hall = tiledRoom("Hall", { x: 4, y: 1, width: 6, height: 3 });
		const spawns = [
			{ x: 2.5, y: 1.5 },
			{ x: 3.5, y: 2.5 },
			{ x: 5.5, y: 2.5 },
		];

		it("walks slowly, and every Bug stays inside its Room", () => {
			const game = createGame({ level: bugLevel(spawns, { rows: open, rooms: [lab, hall] }) });
			const rects = { Lab: { x: 1, y: 1, width: 3, height: 3 }, Hall: { x: 4, y: 1, width: 6, height: 3 } };
			let previous = game.state().bugs;
			let fastest = 0;

			for (let tick = 0; tick < 60 * TICKS_PER_SECOND; tick++) {
				game.step(IDLE);
				const bugs = game.state().bugs;
				bugs.forEach((bug, i) => {
					const rect = rects[bug.room as keyof typeof rects];
					expect(bug.x).toBeGreaterThan(rect.x);
					expect(bug.x).toBeLessThan(rect.x + rect.width);
					expect(bug.y).toBeGreaterThan(rect.y);
					expect(bug.y).toBeLessThan(rect.y + rect.height);
					const last = previous[i] as { x: number; y: number };
					fastest = Math.max(fastest, Math.hypot(bug.x - last.x, bug.y - last.y));
				});
				previous = bugs;
			}

			// Slow: less than half the player's 3 tiles per second.
			expect(fastest * TICKS_PER_SECOND).toBeLessThan(1.5);
			// But they do walk: no Bug is at its spawn after a minute.
			game.state().bugs.forEach((bug, i) => {
				expect({ x: bug.x, y: bug.y }).not.toEqual(spawns[i]);
			});
		});

		it("stops a Bug when it is fixed", () => {
			const game = createGame({ level: bugLevel([{ x: 6.5, y: 1.5 }]) });
			game.step(SHOOT);
			const fixedAt = game.state().bugs[0];

			stepTicks(game, IDLE, 5 * TICKS_PER_SECOND);

			expect(game.state().bugs[0]).toEqual(fixedAt);
		});
	});

	describe("sprites", () => {
		/** Every Bug frame of the machine art set is a solid green 30x39 image, anchored 35 texels below its top. */
		const greenBug = (() => {
			const rgba = new Uint8Array(30 * 39 * 4);
			new Uint32Array(rgba.buffer).fill(GREEN);
			const image = { texture: createTexture(30, 39, rgba), left: 15, top: 35 };
			return Object.fromEntries(bugFrameNames(MACHINE_ART_SET).map((name) => [name, image]));
		})();

		/** Green pixels are Bug pixels: the walls, floor, and ceiling here have no green. */
		function bugPixels(frame: Framebuffer): number[] {
			const found: number[] = [];
			frame.pixels.forEach((pixel, i) => {
				const [red, green, blue] = channels(pixel);
				if (green > 0 && red === 0 && blue === 0) found.push(i);
			});
			return found;
		}

		function render(game: Game): Framebuffer {
			const frame = createFramebuffer(SCREEN_WIDTH, SCREEN_HEIGHT);
			game.render(frame);
			return frame;
		}

		function bugGame(bugs: { x: number; y: number }[], rowsOverride?: string[]): Game {
			return createGame({
				level: bugLevel(bugs, { rows: rowsOverride }),
				textures: { [TEST_WALL_TEXTURE]: solidTexture(WHITE) },
				sprites: greenBug,
			});
		}

		it("draws a Bug in front of the player, in the middle of the view", () => {
			const pixels = bugPixels(render(bugGame([{ x: 4.5, y: 1.5 }])));

			expect(pixels.length).toBeGreaterThan(100);
			expect(pixels).toContain(HORIZON * SCREEN_WIDTH + SCREEN_WIDTH / 2);
		});

		it("hides a Bug behind a wall", () => {
			const walled = ["###########", "#P..#.....#", "#.........#", "#.........#", "###########"];
			expect(bugPixels(render(bugGame([{ x: 6.5, y: 1.5 }], walled)))).toEqual([]);
		});

		it("draws a nearer Bug over a farther one", () => {
			const center = HORIZON * SCREEN_WIDTH + SCREEN_WIDTH / 2;
			const nearOnly = render(bugGame([{ x: 3.5, y: 1.5 }])).pixels[center];
			// The farther Bug comes first in the Level, and the nearer one still covers it.
			const both = render(
				bugGame([
					{ x: 8.5, y: 1.5 },
					{ x: 3.5, y: 1.5 },
				]),
			).pixels[center];
			const farOnly = render(bugGame([{ x: 8.5, y: 1.5 }])).pixels[center];

			expect(brightness(farOnly as number)).toBeLessThan(brightness(nearOnly as number));
			expect(both).toBe(nearOnly);
		});

		it("removes a fixed Bug from the view once its death animation ends", () => {
			const game = bugGame([{ x: 4.5, y: 1.5 }]);
			game.step(SHOOT);
			expect(bugPixels(render(game)).length).toBeGreaterThan(0);

			stepTicks(game, IDLE, 2 * TICKS_PER_SECOND);

			expect(bugPixels(render(game))).toEqual([]);
		});

		it("fails with a clear error when a Bug sprite is missing", () => {
			const missing = MACHINE_ART_SET.bugWalkFrames[1] as string;
			const { [missing]: _, ...withoutOne } = greenBug;
			expect(() => createGame({ level: bugLevel([]), sprites: withoutOne })).toThrow(`"${missing}"`);
		});

		it("walks in its walk frames, in turn, and plays each fix frame once when shot, then is gone", () => {
			// A Room too small to walk in keeps the Bug in the middle of the view.
			const closet = tiledRoom("Closet", { x: 3.4, y: 1.4, width: 0.2, height: 0.2 });
			const colors = { W1: RED, W2: BLUE, F1: rgb(255, 255, 0), F2: rgb(0, 255, 255), F3: rgb(255, 0, 255) };
			const sprites = Object.fromEntries(
				Object.entries(colors).map(([name, color]) => {
					const rgba = new Uint8Array(30 * 39 * 4);
					new Uint32Array(rgba.buffer).fill(color);
					return [name, { texture: createTexture(30, 39, rgba), left: 15, top: 35 }];
				}),
			);
			const game = createGame({
				level: bugLevel([{ x: 3.5, y: 1.5 }], { rooms: [closet], wall: "wall-a" }),
				textures: { "wall-a": solidTexture(GREEN), ...flatTexturesOf(MACHINE_ART_SET, rgb(0, 0, 0)) },
				artSet: {
					...MACHINE_ART_SET,
					bugWalkFrames: ["W1", "W2"],
					bugFixFrames: ["F1", "F2", "F3"],
				},
				sprites,
			});
			/** The frame in the middle of the view, by the channels its color lights; "none" when the Bug is not there. */
			const frameShown = (): string => {
				const lit = channels(pixelAt(render(game), SCREEN_WIDTH / 2, HORIZON)).map((value) => value > 0);
				const name = Object.entries(colors).find(([, color]) =>
					channels(color).every((value, i) => value > 0 === lit[i]),
				)?.[0];
				return name ?? "none";
			};
			/** The frames shown tick by tick, with repeats removed. */
			const framesOver = (ticks: number): string[] => {
				const shown: string[] = [];
				for (let tick = 0; tick < ticks; tick++) {
					const frame = frameShown();
					if (shown.at(-1) !== frame) shown.push(frame);
					game.step(IDLE);
				}
				return shown;
			};

			expect(framesOver(TICKS_PER_SECOND / 2)).toEqual(["W1", "W2", "W1"]);
			game.step(SHOOT);
			expect(framesOver(2 * TICKS_PER_SECOND)).toEqual(["F1", "F2", "F3", "none"]);
		});
	});

	describe("HUD counter", () => {
		/** The value pixels in columns [fromX, toX) of the status bar, moved to start at (0, 0). */
		function valueShape(frame: Framebuffer, fromX: number, toX: number): string[] {
			const found: [number, number][] = [];
			for (let y = SCREEN_HEIGHT - STATUS_BAR_HEIGHT; y < SCREEN_HEIGHT; y++) {
				for (let x = fromX; x < toX; x++) {
					if (pixelAt(frame, x, y) === HUD_VALUE_COLOR) found.push([x, y]);
				}
			}
			const minX = Math.min(...found.map(([x]) => x));
			const minY = Math.min(...found.map(([, y]) => y));
			return found.map(([x, y]) => `${x - minX},${y - minY}`).sort();
		}
		/** The counter is the right part of the status bar; the Room name is on the left. */
		const counterShape = (frame: Framebuffer) => valueShape(frame, SCREEN_WIDTH - 130, SCREEN_WIDTH);
		const roomShape = (frame: Framebuffer) => valueShape(frame, 0, SCREEN_WIDTH / 2);

		/** Two Bugs in a Room whose name is `roomName`. */
		function twoBugs(roomName: string): Game {
			const named = tiledRoom(roomName, { x: 1, y: 1, width: 9, height: 3 });
			return createGame({
				level: bugLevel(
					[
						{ x: 6.5, y: 1.5 },
						{ x: 7.5, y: 3.5 },
					],
					{ rooms: [named] },
				),
			});
		}

		function renderNow(game: Game): Framebuffer {
			const frame = createFramebuffer(SCREEN_WIDTH, SCREEN_HEIGHT);
			game.render(frame);
			return frame;
		}

		it("shows Bugs fixed out of the total, and counts up when the player fixes one", () => {
			// The counter and the Room name are both HUD values: the counter must look like a Room
			// whose name is the expected count.
			const game = twoBugs("Lobby");

			expect(counterShape(renderNow(game))).toEqual(roomShape(renderNow(twoBugs("0/2"))));
			game.step(SHOOT);
			expect(counterShape(renderNow(game))).toEqual(roomShape(renderNow(twoBugs("1/2"))));
		});

		/** The pixels of `color` in the status bar, as groups of touching pixels, left to right. */
		function shapesOf(frame: Framebuffer, color: number): { x: number; y: number }[][] {
			const top = SCREEN_HEIGHT - STATUS_BAR_HEIGHT;
			const seen = new Set<number>();
			const shapes: { x: number; y: number }[][] = [];
			for (let start = top * SCREEN_WIDTH; start < frame.pixels.length; start++) {
				if (frame.pixels[start] !== color || seen.has(start)) continue;
				const shape: { x: number; y: number }[] = [];
				const todo = [start];
				seen.add(start);
				while (todo.length > 0) {
					const i = todo.pop() as number;
					const x = i % SCREEN_WIDTH;
					const y = Math.floor(i / SCREEN_WIDTH);
					shape.push({ x, y });
					for (let dy = -1; dy <= 1; dy++) {
						for (let dx = -1; dx <= 1; dx++) {
							const nx = x + dx;
							const ny = y + dy;
							const next = ny * SCREEN_WIDTH + nx;
							if (nx < 0 || nx >= SCREEN_WIDTH || ny < top || ny >= SCREEN_HEIGHT) continue;
							if (seen.has(next) || frame.pixels[next] !== color) continue;
							seen.add(next);
							todo.push(next);
						}
					}
				}
				shapes.push(shape);
			}
			return shapes.sort((a, b) => Math.min(...a.map(({ x }) => x)) - Math.min(...b.map(({ x }) => x)));
		}

		/** Each tally box, left to right: true when it has a tick (a pixel inside its edges). */
		function tally(frame: Framebuffer, color: number): boolean[] {
			return shapesOf(frame, color).map((shape) => {
				const xs = shape.map(({ x }) => x);
				const ys = shape.map(({ y }) => y);
				const [left, right, top, bottom] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
				return shape.some(({ x, y }) => x > left && x < right && y > top && y < bottom);
			});
		}

		const TALLY_COLOR = rgb(255, 0, 255);

		/** Two Bugs, in an art set like the machine one whose HUD draws a tally in `TALLY_COLOR`. */
		function twoBugsWithTally(): Game {
			const rgba = new Uint8Array(4 * 4 * 4);
			new Uint32Array(rgba.buffer).fill(GREEN);
			const image = { texture: createTexture(4, 4, rgba), left: 2, top: 3 };
			const artSet: ArtSet = { ...MACHINE_ART_SET, hud: { ...MACHINE_ART_SET.hud, tally: [255, 0, 255] } };
			return createGame({
				level: bugLevel(
					[
						{ x: 6.5, y: 1.5 },
						{ x: 7.5, y: 3.5 },
					],
					{ wall: "wall-a" },
				),
				artSet,
				sprites: Object.fromEntries(bugFrameNames(artSet).map((name) => [name, image])),
			});
		}

		it("draws a tick box per Bug next to the counter when the art set has a tally, ticked for each fixed Bug", () => {
			const game = twoBugsWithTally();

			expect(tally(renderNow(game), TALLY_COLOR)).toEqual([false, false]);
			game.step(SHOOT);
			expect(tally(renderNow(game), TALLY_COLOR)).toEqual([true, false]);
		});

		it("puts the tally right of the counter value, inside the Bugs fixed section", () => {
			const frame = renderNow(twoBugsWithTally());
			const boxes = shapesOf(frame, TALLY_COLOR).flat();
			const counter = shapesOf(frame, HUD_VALUE_COLOR)
				.flat()
				.filter(({ x }) => x > SCREEN_WIDTH / 2);

			expect(boxes.length).toBeGreaterThan(0);
			expect(counter.length).toBeGreaterThan(0);
			expect(Math.min(...boxes.map(({ x }) => x))).toBeGreaterThan(Math.max(...counter.map(({ x }) => x)));
			expect(Math.max(...boxes.map(({ x }) => x))).toBeLessThan(SCREEN_WIDTH - 4);
		});

		it("fails with a clear error when the tally of the Level's Bugs does not fit in the status bar", () => {
			const image = { texture: createTexture(4, 4, new Uint8Array(4 * 4 * 4)), left: 2, top: 3 };
			const artSet: ArtSet = { ...MACHINE_ART_SET, hud: { ...MACHINE_ART_SET.hud, tally: [255, 0, 255] } };
			// 60 Bugs need 60 tick boxes, 10 pixels apart: more than the 640-pixel status bar holds.
			const bugs = Array.from({ length: 60 }, (_, i) => ({ x: 1.5 + (i % 9), y: 1.2 + 0.2 * Math.floor(i / 9) }));

			expect(() =>
				createGame({
					level: bugLevel(bugs, { wall: "wall-a" }),
					artSet,
					sprites: Object.fromEntries(bugFrameNames(artSet).map((name) => [name, image])),
				}),
			).toThrow(/Bug tally of 60 Bugs does not fit/);
		});

		it("draws no tally in the machine HUD: its lines are only the top edge and the two section outlines", () => {
			const game = twoBugs("Lobby");
			game.step(SHOOT);
			const lines = shapesOf(renderNow(game), rgb(...MACHINE_ART_SET.hud.outline));

			expect(lines).toHaveLength(3);
		});
	});

	describe("shot feedback", () => {
		// The player stands still and faces a wall 3.5 tiles away. Only a shake can move the wall's top edge.
		const still = ["#######", "#P...##", "#######"];

		/** The screen row of the wall's top edge in the center column, once per tick. */
		function wallTopRowsAfterShot(settings: Parameters<typeof createGame>[0]["settings"]): Set<number> {
			const game = createGame({ level: tiledLevel({ rows: still }), settings });
			const framebuffer = createFramebuffer(SCREEN_WIDTH, SCREEN_HEIGHT);
			const rowsSeen = new Set<number>();
			game.step(SHOOT);
			for (let i = 0; i < 20; i++) {
				game.render(framebuffer);
				let y = 0;
				while (isCeiling(pixelAt(framebuffer, SCREEN_WIDTH / 4, y))) y++;
				rowsSeen.add(y);
				game.step(IDLE);
			}
			return rowsSeen;
		}

		it("shakes the view for a moment after a shot", () => {
			expect(wallTopRowsAfterShot({}).size).toBeGreaterThan(1);
		});

		it("does not shake the view when reduced motion is on", () => {
			expect(wallTopRowsAfterShot({ reducedMotion: true }).size).toBe(1);
		});

		it("draws a crosshair in the middle of the view, where shots go", () => {
			const game = createGame({ level: tiledLevel({ rows: still }) });
			const frame = createFramebuffer(SCREEN_WIDTH, SCREEN_HEIGHT);
			game.render(frame);
			const centerX = SCREEN_WIDTH / 2;
			const near = (dx: number, dy: number) =>
				[1, 2, 3, 4, 5, 6].some((step) => pixelAt(frame, centerX + dx * step, HORIZON + dy * step) === CROSSHAIR_COLOR);

			expect(near(1, 0) && near(-1, 0) && near(0, 1) && near(0, -1)).toBe(true);
			expect(pixelAt(frame, 0, HORIZON)).not.toBe(CROSSHAIR_COLOR);
		});

		it("draws a one-pixel outline around the crosshair when the art set has one", () => {
			const outline = rgb(255, 0, 255);
			const artSet: ArtSet = { ...MACHINE_ART_SET, hud: { ...MACHINE_ART_SET.hud, crosshairOutline: [255, 0, 255] } };
			const game = createGame({ level: tiledLevel({ rows: still, wallTextures: { "#": "wall-a" } }), artSet });
			const frame = createFramebuffer(SCREEN_WIDTH, SCREEN_HEIGHT);
			game.render(frame);
			const centerX = SCREEN_WIDTH / 2;
			// Along the right arm, the outline hugs the crosshair on every side. The center stays clear; the
			// outline of the up and down arms touches its corners.
			const row = (dy: number) =>
				[0, 1, 2, 3, 4, 5, 6, 7].map((dx) => {
					const pixel = pixelAt(frame, centerX + dx, HORIZON + dy);
					return pixel === CROSSHAIR_COLOR ? "+" : pixel === outline ? "o" : ".";
				});

			expect(row(-1).join("")).toBe("ooooooo.");
			expect(row(0).join("")).toBe(".o++++o.");
			expect(row(1).join("")).toBe("ooooooo.");
		});
	});
});

describe("Doors", () => {
	// A corridor: the player starts at x 1.5 and faces east, at a door in the cell x 3..4.
	const corridor = ["######", "#P.D.#", "######"];

	it("lists each door cell of the Level as closed in the Game core state", () => {
		const game = createGame({ level: tiledLevel({ rows: corridor }) });
		expect(game.state().doors).toEqual([{ x: 3, y: 1, state: "closed", open: 0 }]);
	});

	it("stops the player at a closed door", () => {
		const game = createGame({ level: tiledLevel({ rows: corridor }) });
		stepTicks(game, FORWARD, 60);
		expect(game.state().player.x).toBeLessThan(3);
		expect(game.state().player.x).toBeGreaterThan(2.5);
	});

	it("opens a closed door when the player uses it, keeps it open, and lets the player walk through", () => {
		const game = createGame({ level: tiledLevel({ rows: corridor }) });
		stepTicks(game, FORWARD, 30); // walk up to the door
		game.step(USE);
		expect(game.state().doors[0]?.state).toBe("opening");

		stepTicks(game, IDLE, 120);
		expect(game.state().doors[0]).toMatchObject({ state: "open", open: 1 });

		stepTicks(game, FORWARD, 60);
		expect(game.state().player.x).toBeGreaterThan(4);
		expect(game.state().doors[0]).toMatchObject({ state: "open", open: 1 });
	});

	it("slides the door open over several ticks after one use", () => {
		const game = createGame({ level: tiledLevel({ rows: corridor, playerOffset: { x: 1.5, y: 0.5 } }) });
		game.step(USE);
		game.step(IDLE);
		const { open } = game.state().doors[0] as DoorState;
		expect(open).toBeGreaterThan(0);
		expect(open).toBeLessThan(1);
	});

	it("does not open a door that is out of use range", () => {
		const game = createGame({ level: tiledLevel({ rows: ["########", "#P...D.#", "########"] }) });
		game.step(USE);
		stepTicks(game, IDLE, 120);
		expect(game.state().doors[0]).toMatchObject({ state: "closed", open: 0 });
	});

	it("measures the use range to the door panel the player sees, in the middle of the door cell", () => {
		// The door cell starts 1.2 tiles ahead, but its panel (at x 4.5) is 1.7 tiles ahead: out of range.
		const rows = ["#######", "#P..D.#", "#######"];
		const far = createGame({ level: tiledLevel({ rows, playerOffset: { x: 1.8, y: 0.5 } }) });
		far.step(USE);
		expect(far.state().doors[0]?.state).toBe("closed");

		// Its panel is 1.4 tiles ahead: in range.
		const near = createGame({ level: tiledLevel({ rows, playerOffset: { x: 2.1, y: 0.5 } }) });
		near.step(USE);
		expect(near.state().doors[0]?.state).toBe("opening");
	});

	it("does not open a door the player is not facing", () => {
		const game = createGame({
			level: tiledLevel({ rows: corridor, playerOffset: { x: 1.5, y: 0.5 }, playerAngle: 180 }),
		});
		game.step(USE);
		stepTicks(game, IDLE, 120);
		expect(game.state().doors[0]).toMatchObject({ state: "closed", open: 0 });
	});

	it("does not slide a door while the game is paused", () => {
		const game = createGame({ level: tiledLevel({ rows: corridor, playerOffset: { x: 1.5, y: 0.5 } }) });
		game.step(USE);
		const opening = game.state().doors[0];
		game.pause();
		stepTicks(game, IDLE, 120);
		expect(game.state().doors[0]).toEqual(opening);
	});

	it("stops a shot at a closed door, and lets it pass once the door is open", () => {
		// A Bug stands behind the door. Its Room is too small to walk in, so it stays in the line of fire.
		const level = tiledLevel({
			rows: ["#######", "#P.D..#", "#######"],
			playerOffset: { x: 1.2, y: 0.5 },
			extraObjects: [tiledRoom("Closet", { x: 4.9, y: 1.4, width: 0.2, height: 0.2 }), tiledBug({ x: 5, y: 1.5 })],
		});
		const game = createGame({ level });
		const SHOOT: InputSnapshot = { ...IDLE, shoot: true };

		game.step(SHOOT);
		expect(game.state().bugsFixed).toBe(0);

		game.step(USE);
		stepTicks(game, IDLE, 120);
		game.step(SHOOT);
		expect(game.state().bugsFixed).toBe(1);
	});

	it("lets a shot pass through the open part of a door that is still sliding open", () => {
		// The door slides toward the top wall, so its gap opens at the top of the corridor. The player
		// and the Bug are both near the top, so the line of fire goes through the gap.
		const level = tiledLevel({
			rows: ["#######", "#P.D..#", "#######"],
			playerOffset: { x: 1.2, y: 0.25 },
			extraObjects: [tiledRoom("Closet", { x: 4.9, y: 1.15, width: 0.2, height: 0.2 }), tiledBug({ x: 5, y: 1.25 })],
		});
		const game = createGame({ level });
		const SHOOT: InputSnapshot = { ...IDLE, shoot: true };

		game.step(USE);
		stepTicks(game, IDLE, 25);
		expect(game.state().doors[0]?.state).toBe("opening");
		game.step(SHOOT);

		expect(game.state().bugsFixed).toBe(1);
	});

	describe("rendering", () => {
		// Walls are red, the door is green, and the door track is blue.
		const textures = {
			[TEST_WALL_TEXTURE]: solidTexture(RED),
			[TEST_DOOR_TEXTURE]: solidTexture(GREEN),
			[TEST_TRACK_TEXTURE]: solidTexture(BLUE),
		};
		/** The player at x 1.5 faces east, at a door in the cell x 3..4, with a wall 4 tiles behind it. */
		const hall = ["##########", "#P.D....##", "##########"];

		function render(game: Game): Framebuffer {
			const frame = createFramebuffer(SCREEN_WIDTH, SCREEN_HEIGHT);
			game.render(frame);
			return frame;
		}

		/** The main color channel of a pixel: the brightest one, or "none" for gray. */
		function hue(pixel: number): "red" | "green" | "blue" | "none" {
			const [red, green, blue] = channels(pixel);
			if (red > green && red > blue) return "red";
			if (green > red && green > blue) return "green";
			if (blue > red && blue > green) return "blue";
			return "none";
		}

		/** How many columns of the horizon row show the door. */
		function doorColumns(frame: Framebuffer): number {
			let count = 0;
			for (let x = 0; x < SCREEN_WIDTH; x++) {
				const pixel = pixelAt(frame, x, HORIZON);
				if (pixel !== CROSSHAIR_COLOR && hue(pixel) === "green") count++;
			}
			return count;
		}

		/** The number of rows in the center column that are not floor or ceiling. */
		function centerWallHeight(frame: Framebuffer): number {
			let rows = 0;
			for (let y = 0; y < VIEW_HEIGHT; y++) {
				const pixel = pixelAt(frame, SCREEN_WIDTH / 2, y);
				if (!isCeiling(pixel) && !isFloor(pixel) && pixel !== CROSSHAIR_COLOR) rows++;
			}
			return rows;
		}

		it("draws a closed door with the door texture", () => {
			const game = createGame({ level: tiledLevel({ rows: hall }), textures });
			expect(hue(pixelAt(render(game), SCREEN_WIDTH / 2, HORIZON))).toBe("green");
		});

		it("draws the door as a thin panel in the middle of its cell", () => {
			// The door panel is at x 3.5, 2 tiles from the player: as high as a wall 2 tiles away.
			const door = createGame({ level: tiledLevel({ rows: hall }), textures });
			const wall = createGame({
				level: tiledLevel({ rows: ["######", "#P..##", "######"], playerOffset: { x: 1, y: 0.5 } }),
				textures,
			});
			expect(centerWallHeight(render(door))).toBe(centerWallHeight(render(wall)));
		});

		it("slides the door texture aside as the door opens, and shows what is behind it", () => {
			const game = createGame({ level: tiledLevel({ rows: hall, playerOffset: { x: 1.5, y: 0.5 } }), textures });
			const closed = doorColumns(render(game));
			game.step(USE);
			while ((game.state().doors[0] as DoorState).open < 0.5) game.step(IDLE);
			const halfOpen = render(game);
			stepTicks(game, IDLE, 120);
			const open = render(game);

			expect(closed).toBeGreaterThan(0);
			expect(doorColumns(halfOpen)).toBeGreaterThan(0);
			expect(doorColumns(halfOpen)).toBeLessThan(closed * 0.7);
			expect(doorColumns(open)).toBe(0);
			// Through the open door, the player sees the far wall.
			expect(hue(pixelAt(open, SCREEN_WIDTH / 2, HORIZON))).toBe("red");
		});

		it("draws the door track on the side walls of the door cell", () => {
			// Right in front of the door cell, the edge columns look at its side walls.
			const game = createGame({ level: tiledLevel({ rows: hall, playerOffset: { x: 1.75, y: 0.5 } }), textures });
			const frame = render(game);
			expect(hue(pixelAt(frame, 0, HORIZON))).toBe("blue");
			expect(hue(pixelAt(frame, SCREEN_WIDTH - 1, HORIZON))).toBe("blue");
		});

		it("draws a door in a north-south passage too", () => {
			const game = createGame({
				level: tiledLevel({ rows: ["###", "#P#", "#.#", "#D#", "#.#", "###"], playerAngle: 90 }),
				textures,
			});
			expect(hue(pixelAt(render(game), SCREEN_WIDTH / 2, HORIZON))).toBe("green");
		});
	});

	it("fails with a clear error when a door is not in a doorway", () => {
		const level = tiledLevel({ rows: ["#####", "#P..#", "#.D.#", "#####"] });
		expect(() => createGame({ level })).toThrow(/door at cell \(2, 2\) must have walls on two opposite sides/);
	});

	it("fails with a clear error when a door tile has no track texture", () => {
		const level = tiledLevel({ rows: corridor, doorTiles: { D: { texture: "door", track: "" } } });
		expect(() => createGame({ level })).toThrow(/Door tile gid 2 has no "track" property/);
	});

	it("lists the door and track textures in the textures the Level uses", () => {
		expect(levelTextureNames(tiledLevel({ rows: corridor }))).toEqual([
			TEST_DOOR_TEXTURE,
			TEST_TRACK_TEXTURE,
			TEST_WALL_TEXTURE,
		]);
	});

	it("has a door between two Rooms in the real sample Level", () => {
		type TiledObject = { type: string; name: string; x: number; y: number; width: number; height: number };
		const { layers, tilewidth: size } = sampleLevel as unknown as {
			layers: { objects?: TiledObject[] }[];
			tilewidth: number;
		};
		const rooms = layers.flatMap((layer) => layer.objects ?? []).filter((object) => object.type === "room");
		/** The name of the Room that holds the center of a cell. */
		const roomOf = (x: number, y: number) => {
			const [px, py] = [(x + 0.5) * size, (y + 0.5) * size];
			return rooms.find((r) => px >= r.x && px < r.x + r.width && py >= r.y && py < r.y + r.height)?.name;
		};
		const joinsTwoRooms = ({ x, y }: DoorState) =>
			[
				[roomOf(x - 1, y), roomOf(x + 1, y)],
				[roomOf(x, y - 1), roomOf(x, y + 1)],
			].some(([a, b]) => a !== undefined && b !== undefined && a !== b);

		expect(createGame({ level: sampleLevel, content: EXHIBITS }).state().doors.some(joinsTwoRooms)).toBe(true);
	});
});

describe("Sound", () => {
	const SHOOT: InputSnapshot = { ...IDLE, shoot: true };

	it("reports a shot sound each time the player fires, and no sound on the ticks without a shot", () => {
		const sound = vi.fn();
		const game = createGame({ level: tiledLevel({ rows: ["#####", "#P..#", "#####"] }), sound });

		stepTicks(game, FORWARD, 10);
		expect(sound).not.toHaveBeenCalled();

		game.step(SHOOT);
		game.step(IDLE);
		game.step(SHOOT);
		expect(sound.mock.calls).toEqual([["shot"], ["shot"]]);
	});

	it("reports no sound while the game is paused", () => {
		const sound = vi.fn();
		const game = createGame({ level: tiledLevel({ rows: ["#####", "#P..#", "#####"] }), sound });

		game.pause();
		stepTicks(game, SHOOT, 10);
		expect(sound).not.toHaveBeenCalled();
	});

	it("reports the door sound once, when the player starts to open a closed door", () => {
		const sound = vi.fn();
		const game = createGame({
			level: tiledLevel({ rows: ["######", "#P.D.#", "######"], playerOffset: { x: 1.5, y: 0.5 } }),
			sound,
		});

		game.step(USE);
		expect(sound.mock.calls).toEqual([["door-open"]]);

		game.step(USE); // the door is already opening
		stepTicks(game, IDLE, 120);
		game.step(USE); // the door is open
		expect(sound.mock.calls).toEqual([["door-open"]]);
	});

	it("reports no door sound when the player uses a wall", () => {
		const sound = vi.fn();
		const game = createGame({ level: tiledLevel({ rows: ["####", "#P.#", "####"] }), sound });

		game.step(USE);
		expect(sound).not.toHaveBeenCalled();
	});
});
