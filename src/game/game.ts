import { moveCircle } from "../engine/collision";
import { type Framebuffer, rgb } from "../engine/framebuffer";
import { isSolid } from "../engine/grid";
import type { InputSnapshot } from "../engine/input";
import { type Camera, createRenderer } from "../engine/renderer";
import type { Texture } from "../engine/texture";
import { assertHudCanDraw, createHud, type HudView, STATUS_BAR_HEIGHT } from "./hud";
import { type Level, loadLevel, roomAt } from "./level";

export { HUD_VALUE_COLOR, STATUS_BAR_HEIGHT } from "./hud";

/** Fixed ticks per second. Every speed below is per tick. */
export const TICKS_PER_SECOND = 60;
const MOVE_SPEED = 3 / TICKS_PER_SECOND; // tiles per tick
const TURN_SPEED = Math.PI / TICKS_PER_SECOND; // radians per tick
const PLAYER_RADIUS = 0.25; // tiles
/** Mouse turn at sensitivity 1: about 0.14 degrees per pixel of mouse movement. */
const LOOK_SPEED = 0.0025; // radians per pixel
/** Head bob: the view moves up and down by up to this many pixels, one full cycle per BOB_TILES walked. */
const BOB_PIXELS = 4;
const BOB_TILES = 1.5;
/** How fast the bob fades in when the player starts walking and fades out when it stops (0 to 1 per tick). */
const BOB_EASE = 0.2;
/** Use reaches a door whose cell is at most this far in front of the player center, in tiles. */
const USE_RANGE = 1.5;
/** How far the use check moves forward per test point, in tiles. */
const USE_PROBE_STEP = 1 / 32;
/** A door slides fully open in this many ticks. */
const DOOR_OPEN_TICKS = 45;

/** The Game core always renders at this size. The browser shell scales it up. */
export const SCREEN_WIDTH = 640;
export const SCREEN_HEIGHT = 360;
export const CEILING_COLOR = rgb(56, 56, 64);
export const FLOOR_COLOR = rgb(84, 72, 60);

/** Player settings that change how the Game core reads input and draws the view. */
export interface GameSettings {
	/** Multiplies the mouse turn. 1 is the default speed. */
	mouseSensitivity: number;
	/** Mouse movement to the right turns the player left. */
	invertMouse: boolean;
	/** The system asks for reduced motion: no head bob. */
	reducedMotion: boolean;
}

export const DEFAULT_GAME_SETTINGS: Readonly<GameSettings> = {
	mouseSensitivity: 1,
	invertMouse: false,
	reducedMotion: false,
};

export interface GameOptions {
	/** Parsed Tiled JSON for the Level. */
	level: unknown;
	/**
	 * Decoded textures by name. It must hold every wall, door, and track texture the Level names (see `levelTextureNames`).
	 * Leave it out only when the walls do not matter (as in movement tests): walls then draw magenta.
	 */
	textures?: Readonly<Record<string, Texture>>;
	/** Settings that are not given use DEFAULT_GAME_SETTINGS. */
	settings?: Partial<GameSettings>;
}

export interface PlayerState {
	x: number;
	y: number;
	angle: number;
}

export interface DoorState {
	/** The door cell, in tiles. */
	x: number;
	y: number;
	/** A door starts closed. Use starts its slide; once open, it stays open. */
	state: "closed" | "opening" | "open";
	/** How far the door has slid open, from 0 (closed) to 1 (open). */
	open: number;
}

export interface GameState {
	player: PlayerState;
	/** While paused, steps change nothing. */
	paused: boolean;
	/**
	 * The name of the Room the player is in. Between Room rectangles (in a doorway,
	 * for example) it keeps the last Room. It is null before the player enters any Room.
	 */
	room: string | null;
	/** Every door of the Level, row by row. */
	doors: DoorState[];
}

export interface Game {
	/** Advances the game by one fixed tick. It does nothing while the game is paused. */
	step(input: InputSnapshot): void;
	pause(): void;
	resume(): void;
	/** Changes some settings. They apply from the next tick on. */
	updateSettings(settings: Partial<GameSettings>): void;
	state(): GameState;
	/** Draws the current view and the HUD into a caller-provided 640x360 framebuffer. */
	render(framebuffer: Framebuffer): void;
}

export function createGame(options: GameOptions): Game {
	const level: Level = loadLevel(options.level);
	const player: PlayerState = { ...level.playerStart };
	let paused = false;
	const settings: GameSettings = { ...DEFAULT_GAME_SETTINGS, ...options.settings };
	// Head bob follows the distance the player really walked, so walking into a wall does not bob.
	let bobPhase = 0;
	let bobStrength = 0;
	const camera: Camera = { x: 0, y: 0, angle: 0, horizonOffset: 0 };
	for (const { name } of level.rooms) assertHudCanDraw(name, `Room "${name}"`);
	let room = roomAt(level.rooms, player.x, player.y)?.name ?? null;
	const doors: DoorState[] = level.doors.map(({ x, y }) => ({ x, y, state: "closed", open: 0 }));
	const renderer = createRenderer({
		width: SCREEN_WIDTH,
		height: SCREEN_HEIGHT,
		wallTextures: texturesFor(level.wallTextures, options.textures),
		trackTextures: texturesFor(level.doorTracks, options.textures),
		ceilingColor: CEILING_COLOR,
		floorColor: FLOOR_COLOR,
		viewHeight: SCREEN_HEIGHT - STATUS_BAR_HEIGHT,
	});
	const hud = createHud(SCREEN_WIDTH, SCREEN_HEIGHT);
	// Reused every frame, so rendering allocates nothing.
	const hudView: HudView = { room: null };

	/** Starts the slide of the closed door that the player faces within use range, if there is one. */
	function useDoorAhead(): void {
		const dirX = Math.cos(player.angle);
		const dirY = Math.sin(player.angle);
		for (let distance = USE_PROBE_STEP; distance <= USE_RANGE; distance += USE_PROBE_STEP) {
			const x = Math.floor(player.x + dirX * distance);
			const y = Math.floor(player.y + dirY * distance);
			if (!isSolid(level.walls, x, y)) continue;
			const door = doors.find((d) => d.x === x && d.y === y);
			if (door?.state === "closed") door.state = "opening";
			return;
		}
	}

	function slideDoors(): void {
		const open = level.walls.doors;
		for (const door of doors) {
			if (door.state !== "opening") continue;
			door.open = Math.min(1, door.open + 1 / DOOR_OPEN_TICKS);
			if (door.open === 1) door.state = "open";
			open[door.y * level.walls.width + door.x] = door.open;
		}
	}

	return {
		step(input) {
			if (paused) return;
			if (input.use) useDoorAhead();
			slideDoors();
			const lookDirection = settings.invertMouse ? -1 : 1;
			player.angle += clampAxis(input.turn) * TURN_SPEED;
			player.angle += input.look * LOOK_SPEED * settings.mouseSensitivity * lookDirection;
			const forward = clampAxis(input.forward);
			const strafe = clampAxis(input.strafe);
			const cos = Math.cos(player.angle);
			const sin = Math.sin(player.angle);
			// Strafe right is the forward direction turned 90 degrees clockwise (y points down).
			let dx = forward * cos - strafe * sin;
			let dy = forward * sin + strafe * cos;
			const length = Math.hypot(dx, dy);
			if (length > 1) {
				dx /= length;
				dy /= length;
			}
			const fromX = player.x;
			const fromY = player.y;
			moveCircle(level.walls, player, dx * MOVE_SPEED, dy * MOVE_SPEED, PLAYER_RADIUS);
			const walked = Math.hypot(player.x - fromX, player.y - fromY);
			bobPhase = (bobPhase + (walked / BOB_TILES) * 2 * Math.PI) % (2 * Math.PI);
			bobStrength += (Math.min(1, walked / MOVE_SPEED) - bobStrength) * BOB_EASE;
			room = roomAt(level.rooms, player.x, player.y)?.name ?? room;
		},
		pause() {
			paused = true;
		},
		resume() {
			paused = false;
		},
		updateSettings(changes) {
			Object.assign(settings, changes);
		},
		state: () => ({ player: { ...player }, room, paused, doors: doors.map((door) => ({ ...door })) }),
		render(framebuffer) {
			camera.x = player.x;
			camera.y = player.y;
			camera.angle = player.angle;
			camera.horizonOffset = settings.reducedMotion ? 0 : Math.sin(bobPhase) * bobStrength * BOB_PIXELS;
			renderer.render(framebuffer, level.walls, camera);
			hudView.room = room;
			hud.draw(framebuffer, hudView);
		},
	};
}

/** The names of the textures that a Level (parsed Tiled JSON) uses, so the caller can load them first. */
export function levelTextureNames(level: unknown): string[] {
	const { wallTextures, doorTracks } = loadLevel(level);
	const names = [...wallTextures, ...doorTracks].filter((name) => name !== undefined);
	return [...new Set(names)].sort();
}

/** Looks up the texture of each cell value by name. */
function texturesFor(names: Level["wallTextures"], textures: GameOptions["textures"]): (Texture | undefined)[] {
	if (!textures) return [];
	return names.map((name) => {
		if (name === undefined) return undefined;
		const texture = textures[name];
		if (!texture) throw new Error(`The Level uses texture "${name}", but no texture has that name.`);
		return texture;
	});
}

function clampAxis(value: number): number {
	return value < -1 ? -1 : value > 1 ? 1 : value;
}
