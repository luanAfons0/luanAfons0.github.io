import { cellAt, type Grid } from "./grid";

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
	/** The solid cell the ray hits. */
	x: number;
	y: number;
	face: Face;
	/** Distance from the origin to the hit, in tiles. */
	distance: number;
}

/**
 * Walks one ray through the grid with DDA (it steps from one cell edge to the next) and returns
 * the first solid cell it hits within `maxDistance` tiles, or null. Cells outside the grid are solid.
 */
export function castRay(grid: Grid, x: number, y: number, angle: number, maxDistance: number): RayHit | null {
	const rayX = Math.cos(angle);
	const rayY = Math.sin(angle);
	let mapX = Math.floor(x);
	let mapY = Math.floor(y);
	const deltaX = rayX === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / rayX);
	const deltaY = rayY === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / rayY);
	const stepX = rayX < 0 ? -1 : 1;
	const stepY = rayY < 0 ? -1 : 1;
	let sideX = (rayX < 0 ? x - mapX : mapX + 1 - x) * deltaX;
	let sideY = (rayY < 0 ? y - mapY : mapY + 1 - y) * deltaY;
	for (;;) {
		let distance: number;
		let face: Face;
		if (sideX < sideY) {
			distance = sideX;
			sideX += deltaX;
			mapX += stepX;
			face = stepX > 0 ? Face.West : Face.East;
		} else {
			distance = sideY;
			sideY += deltaY;
			mapY += stepY;
			face = stepY > 0 ? Face.North : Face.South;
		}
		if (distance > maxDistance) return null;
		if (cellAt(grid, mapX, mapY) !== 0) return { x: mapX, y: mapY, face, distance };
	}
}
