import { moveCircle } from "../engine/collision";
import { type Framebuffer, rgb } from "../engine/framebuffer";
import type { InputSnapshot } from "../engine/input";
import { createRenderer } from "../engine/renderer";
import { type Level, loadLevel } from "./level";

/** Fixed ticks per second. Every speed below is per tick. */
export const TICKS_PER_SECOND = 60;
const MOVE_SPEED = 3 / TICKS_PER_SECOND; // tiles per tick
const TURN_SPEED = Math.PI / TICKS_PER_SECOND; // radians per tick
const PLAYER_RADIUS = 0.25; // tiles

/** The Game core always renders at this size. The browser shell scales it up. */
export const SCREEN_WIDTH = 640;
export const SCREEN_HEIGHT = 360;
export const CEILING_COLOR = rgb(56, 56, 64);
export const FLOOR_COLOR = rgb(84, 72, 60);
/** Wall color for each wall tile id in the Level (index 0 is empty). */
const WALL_COLORS = new Uint32Array([0, rgb(150, 150, 150), rgb(140, 90, 60), rgb(70, 110, 70), rgb(70, 80, 130)]);

export interface GameOptions {
	/** Parsed Tiled JSON for the Level. */
	level: unknown;
}

export interface PlayerState {
	x: number;
	y: number;
	angle: number;
}

export interface GameState {
	player: PlayerState;
}

export interface Game {
	/** Advances the game by one fixed tick. */
	step(input: InputSnapshot): void;
	state(): GameState;
	/** Draws the current view into a caller-provided 640x360 framebuffer. */
	render(framebuffer: Framebuffer): void;
}

export function createGame(options: GameOptions): Game {
	const level: Level = loadLevel(options.level);
	const player: PlayerState = { ...level.playerStart };
	const renderer = createRenderer({
		width: SCREEN_WIDTH,
		height: SCREEN_HEIGHT,
		wallColors: WALL_COLORS,
		ceilingColor: CEILING_COLOR,
		floorColor: FLOOR_COLOR,
	});

	return {
		step(input) {
			player.angle += clampAxis(input.turn) * TURN_SPEED;
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
			moveCircle(level.walls, player, dx * MOVE_SPEED, dy * MOVE_SPEED, PLAYER_RADIUS);
		},
		state: () => ({ player: { ...player } }),
		render(framebuffer) {
			renderer.render(framebuffer, level.walls, player);
		},
	};
}

function clampAxis(value: number): number {
	return value < -1 ? -1 : value > 1 ? 1 : value;
}
