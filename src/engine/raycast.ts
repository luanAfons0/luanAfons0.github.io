import { cellAt, doorAt, type Grid, NOT_A_DOOR } from "./grid";

/**
 * The four faces of a grid cell, named by the direction they face (y points down, so north is -y).
 * A ray that moves toward +y hits the north face of the cell it enters.
 */
export const Face = { North: 0, East: 1, South: 2, West: 3 } as const;
export type Face = (typeof Face)[keyof typeof Face];

/** A number that names one face of one cell, for lookups such as `RendererOptions.faceTextures`. */
export function faceKey(grid: Grid, x: number, y: number, face: Face): number {
	return (y * grid.width + x) * 4 + face;
}

export interface RayHit {
	/** The cell the ray hits: a wall cell, or a door cell whose panel it hits. Outside the grid too. */
	x: number;
	y: number;
	/** The cell value (see `cellAt`). */
	cell: number;
	/** The face the ray hits. On a door panel, the side of the panel that faces the ray. */
	face: Face;
	/**
	 * Distance from the origin to the hit, in lengths of the ray direction vector: tiles for a
	 * vector of length 1.
	 */
	distance: number;
	/** True when the ray hits a door panel, false when it hits a wall. */
	door: boolean;
	/** On a door panel: where the ray crosses it, from 0 to 1 across the panel's own texture. */
	doorU: number;
	/**
	 * The cell value of the door cell the ray was in when it hit a wall, else 0. Such a wall is a
	 * side wall of the door cell (its track).
	 */
	insideDoor: number;
}

/** A RayHit to reuse: pass it to `walkRay` or `castRay`. */
export function createRayHit(): RayHit {
	return { x: 0, y: 0, cell: 0, face: Face.North, distance: 0, door: false, doorU: 0, insideDoor: 0 };
}

/**
 * Walks a ray from (x, y) along (rayX, rayY) through the grid with DDA (a digital differential
 * analyzer: it steps from one cell edge to the next). It fills `hit` with the first wall or door
 * panel within `maxDistance` and returns true, or returns false. It allocates nothing.
 *
 * Cells outside the grid are walls. A door (see `Grid.doors`) is a thin panel across the middle of
 * its cell, across the passage: a door with walls north and south of it closes a west-east
 * passage, so its panel is at x + 0.5. The panel has slid `open` of a tile toward the low edge of
 * the cell, and a ray passes through that gap. This is the one place that models doors for rays:
 * the renderer draws what this returns, and the game uses and shoots at what this returns.
 */
export function walkRay(
	grid: Grid,
	x: number,
	y: number,
	rayX: number,
	rayY: number,
	maxDistance: number,
	hit: RayHit,
): boolean {
	let mapX = Math.floor(x);
	let mapY = Math.floor(y);
	const deltaX = rayX === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / rayX);
	const deltaY = rayY === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / rayY);
	const stepX = rayX < 0 ? -1 : 1;
	const stepY = rayY < 0 ? -1 : 1;
	let sideX = (rayX < 0 ? x - mapX : mapX + 1 - x) * deltaX;
	let sideY = (rayY < 0 ? y - mapY : mapY + 1 - y) * deltaY;
	// The door cell value while the ray is inside a door cell, else 0. A ray that starts in a door
	// cell does not hit that cell's panel: only an open door lets anything stand in its cell.
	let insideDoor = doorAt(grid, mapX, mapY) === NOT_A_DOOR ? 0 : cellAt(grid, mapX, mapY);
	// Cells outside the grid are walls, so this loop always ends.
	for (;;) {
		let distance: number;
		let ySide: boolean;
		if (sideX < sideY) {
			distance = sideX;
			sideX += deltaX;
			mapX += stepX;
			ySide = false;
		} else {
			distance = sideY;
			sideY += deltaY;
			mapY += stepY;
			ySide = true;
		}
		if (distance > maxDistance) return false;
		const cell = cellAt(grid, mapX, mapY);
		if (cell === 0) {
			insideDoor = 0;
			continue;
		}
		const open = doorAt(grid, mapX, mapY);
		if (open === NOT_A_DOOR) {
			hit.face = ySide ? (stepY > 0 ? Face.North : Face.South) : stepX > 0 ? Face.West : Face.East;
			hit.door = false;
			hit.doorU = 0;
			hit.insideDoor = insideDoor;
			return fill(hit, mapX, mapY, cell, distance);
		}
		insideDoor = cell;
		const acrossX = cellAt(grid, mapX, mapY - 1) !== 0;
		const panel = acrossX ? (mapX + 0.5 - x) / rayX : (mapY + 0.5 - y) / rayY;
		// The ray must reach the panel before it leaves the cell.
		if (!(panel > 0 && panel < (sideX < sideY ? sideX : sideY))) continue;
		// Where the ray crosses the panel line, from 0 to 1 across the cell.
		const along = acrossX ? y + panel * rayY - mapY : x + panel * rayX - mapX;
		if (along < open) continue;
		if (panel > maxDistance) return false;
		hit.face = acrossX ? (rayX > 0 ? Face.West : Face.East) : rayY > 0 ? Face.North : Face.South;
		hit.door = true;
		hit.doorU = along - open;
		hit.insideDoor = 0;
		return fill(hit, mapX, mapY, cell, panel);
	}
}

function fill(hit: RayHit, x: number, y: number, cell: number, distance: number): true {
	hit.x = x;
	hit.y = y;
	hit.cell = cell;
	hit.distance = distance;
	return true;
}

/**
 * Casts a ray of length 1 from (x, y) in the direction `angle` (see `walkRay`), so the hit
 * distance is in tiles. It fills `hit` and returns true, or returns false when nothing is within
 * `maxDistance` tiles.
 */
export function castRay(grid: Grid, x: number, y: number, angle: number, maxDistance: number, hit: RayHit): boolean {
	return walkRay(grid, x, y, Math.cos(angle), Math.sin(angle), maxDistance, hit);
}
