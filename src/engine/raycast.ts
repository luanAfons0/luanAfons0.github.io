import { cellAt, type Grid } from "./grid";

/**
 * Walks a ray from (x, y) through the grid with DDA and returns the distance to the first solid
 * cell, in tiles. (dirX, dirY) must have length 1. Cells outside the grid are solid, so the ray
 * always ends. It allocates nothing.
 */
export function castRay(grid: Grid, x: number, y: number, dirX: number, dirY: number): number {
	let mapX = Math.floor(x);
	let mapY = Math.floor(y);
	const deltaX = dirX === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / dirX);
	const deltaY = dirY === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / dirY);
	const stepX = dirX < 0 ? -1 : 1;
	const stepY = dirY < 0 ? -1 : 1;
	let sideX = (dirX < 0 ? x - mapX : mapX + 1 - x) * deltaX;
	let sideY = (dirY < 0 ? y - mapY : mapY + 1 - y) * deltaY;
	for (;;) {
		if (sideX < sideY) {
			mapX += stepX;
			if (cellAt(grid, mapX, mapY) !== 0) return sideX;
			sideX += deltaX;
		} else {
			mapY += stepY;
			if (cellAt(grid, mapX, mapY) !== 0) return sideY;
			sideY += deltaY;
		}
	}
}
