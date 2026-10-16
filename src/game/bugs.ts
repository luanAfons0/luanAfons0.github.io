import { moveCircle } from "../engine/collision";
import type { Grid } from "../engine/grid";
import { castRay, createRayHit } from "../engine/raycast";
import type { Sprite, SpriteImage } from "../engine/renderer";
import type { BugSpawn, Room } from "./level";
import type { ArtSet } from "./theme";
import { TICKS_PER_SECOND } from "./ticks";

/** Bugs walk at 0.6 tiles per second (the player walks at 3). Per tick. */
const WALK_SPEED = 0.6 / TICKS_PER_SECOND;
/** A Bug keeps this far from walls and from the edges of its Room, in tiles. */
const BUG_RADIUS = 0.2;
/** A Bug keeps one heading for 1 to 4 seconds (in ticks), then picks a new one. */
const MIN_HEADING_TICKS = 1 * TICKS_PER_SECOND;
const MAX_HEADING_TICKS = 4 * TICKS_PER_SECOND;
/** The same seed every visit, so the Game core stays deterministic. */
const WANDER_SEED = 0x8badf00d;

/** The parts of an art set that the Bugs use. */
export type BugArt = Pick<ArtSet, "name" | "bugWalkFrames" | "bugFixFrames">;

/** Every sprite frame a Bug of the art set uses. The caller loads them and passes them to the Game core. */
export function bugFrameNames(art: BugArt): string[] {
	return [...art.bugWalkFrames, ...art.bugFixFrames];
}

/** Ticks per frame of each animation. */
const WALK_FRAME_TICKS = 10;
const FIX_FRAME_TICKS = 6;
/** Bugs float: the sprite anchor is this high above the floor, in tiles. */
const FLOAT_HEIGHT = 0.2;

/** A shot hits a Bug that passes this close to the line of fire, in tiles. */
const HIT_RADIUS = 0.25;

/** What the Game core shows of one Bug. Positions are in tiles. */
export interface BugState {
	x: number;
	y: number;
	/** The name of the Room the Bug walks in. */
	room: string;
	fixed: boolean;
}

interface Bug {
	x: number;
	y: number;
	spawn: BugSpawn;
	fixed: boolean;
	/** The walk direction, in radians. */
	heading: number;
	/** Ticks left before the Bug picks a new heading. */
	headingTicks: number;
	/** Ticks since the Bug spawned (while it walks) or since it was fixed. */
	animationTicks: number;
	sprite: Sprite;
}

/** The Bugs of a Level: they do no harm, and walk in their Room until the player fixes them. */
export interface Bugs {
	readonly total: number;
	fixedCount(): number;
	/** Advances every Bug by one tick. Bugs that are not fixed walk around their Room. */
	step(walls: Grid): void;
	/**
	 * Fires a shot from (x, y) in the direction `angle`. It fixes the nearest Bug in the line of
	 * fire, if no wall is in front of it, and returns true when it fixed one.
	 */
	shoot(walls: Grid, x: number, y: number, angle: number): boolean;
	/** One sprite per Bug, reused every frame. Draw the first `updateSprites()` of them. */
	readonly sprites: ReadonlyArray<Sprite>;
	/** Moves each Bug sprite to its Bug and picks its animation frame. Returns how many to draw. Allocates nothing. */
	updateSprites(): number;
	state(): BugState[];
}

/**
 * The Bugs of the spawns, drawn with the frames of `art`. `images` must hold every name in
 * `bugFrameNames(art)`. With spawns, the art set needs at least one walk frame and one fix frame.
 */
export function createBugs(
	spawns: readonly BugSpawn[],
	images: Readonly<Record<string, SpriteImage>>,
	art: BugArt,
): Bugs {
	if (spawns.length > 0) {
		if (art.bugWalkFrames.length === 0)
			throw new Error(`The Level has Bugs, but art set "${art.name}" has no Bug walk frame.`);
		if (art.bugFixFrames.length === 0)
			throw new Error(`The Level has Bugs, but art set "${art.name}" has no Bug fix frame.`);
	}
	const frame = (name: string): SpriteImage => {
		const image = images[name];
		if (!image) throw new Error(`The Bug needs sprite "${name}", but no sprite has that name.`);
		return image;
	};
	const walkImages = art.bugWalkFrames.map(frame);
	const fixImages = art.bugFixFrames.map(frame);
	const random = createRandom(WANDER_SEED);
	const bugs: Bug[] = spawns.map((spawn) => ({
		x: spawn.x,
		y: spawn.y,
		spawn,
		fixed: false,
		heading: 0,
		headingTicks: 0,
		animationTicks: 0,
		sprite: { x: spawn.x, y: spawn.y, z: FLOAT_HEIGHT, image: walkImages[0] as SpriteImage },
	}));
	const sprites: Sprite[] = [];
	// Reused by every shot.
	const wallHit = createRayHit();
	return {
		total: bugs.length,
		sprites,
		updateSprites() {
			let count = 0;
			for (const bug of bugs) {
				const images = bug.fixed ? fixImages : walkImages;
				const frameTicks = bug.fixed ? FIX_FRAME_TICKS : WALK_FRAME_TICKS;
				let index = Math.floor(bug.animationTicks / frameTicks);
				if (bug.fixed && index >= images.length) continue; // The fix animation is over: the Bug is gone.
				index %= images.length;
				bug.sprite.x = bug.x;
				bug.sprite.y = bug.y;
				bug.sprite.image = images[index] as SpriteImage;
				sprites[count++] = bug.sprite;
			}
			return count;
		},
		step(walls) {
			for (const bug of bugs) {
				bug.animationTicks++;
				if (bug.fixed) continue;
				if (bug.headingTicks <= 0) {
					bug.heading = random() * 2 * Math.PI;
					bug.headingTicks = MIN_HEADING_TICKS + Math.floor(random() * (MAX_HEADING_TICKS - MIN_HEADING_TICKS));
				}
				bug.headingTicks--;
				const fromX = bug.x;
				const fromY = bug.y;
				moveCircle(walls, bug, Math.cos(bug.heading) * WALK_SPEED, Math.sin(bug.heading) * WALK_SPEED, BUG_RADIUS);
				keepInside(bug, bug.spawn.room);
				// Blocked by a wall or the Room edge: pick a new heading on the next tick.
				if (Math.hypot(bug.x - fromX, bug.y - fromY) < WALK_SPEED / 2) bug.headingTicks = 0;
			}
		},
		fixedCount: () => bugs.filter((bug) => bug.fixed).length,
		shoot(walls, x, y, angle) {
			const dirX = Math.cos(angle);
			const dirY = Math.sin(angle);
			let nearest: Bug | undefined;
			// Cells outside the grid are solid, so the ray always hits a wall.
			let nearestDistance = castRay(walls, x, y, angle, Number.POSITIVE_INFINITY, wallHit)
				? wallHit.distance
				: Number.POSITIVE_INFINITY;
			for (const bug of bugs) {
				if (bug.fixed) continue;
				const dx = bug.x - x;
				const dy = bug.y - y;
				const along = dx * dirX + dy * dirY;
				const across = dx * dirY - dy * dirX;
				if (along > 0 && along < nearestDistance && Math.abs(across) < HIT_RADIUS) {
					nearest = bug;
					nearestDistance = along;
				}
			}
			if (!nearest) return false;
			nearest.fixed = true;
			nearest.animationTicks = 0;
			return true;
		},
		state: () => bugs.map((bug) => ({ x: bug.x, y: bug.y, room: bug.spawn.room.name, fixed: bug.fixed })),
	};
}

/** Keeps a Bug inside its Room rectangle, BUG_RADIUS from the edges (or in the middle of a tiny Room). */
function keepInside(bug: Bug, room: Room): void {
	bug.x = clampInto(bug.x, room.x, room.width);
	bug.y = clampInto(bug.y, room.y, room.height);
}

function clampInto(value: number, start: number, size: number): number {
	if (size <= 2 * BUG_RADIUS) return start + size / 2;
	return Math.min(start + size - BUG_RADIUS, Math.max(start + BUG_RADIUS, value));
}

/** A small seeded random number generator (mulberry32). Returns numbers in [0, 1). */
function createRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
