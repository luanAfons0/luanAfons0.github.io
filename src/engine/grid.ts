/**
 * A 2D grid of cells, stored row by row. A cell value of 0 is empty.
 * Any other value is solid, and the renderer uses it to pick the wall color.
 */
export interface Grid {
	width: number;
	height: number;
	cells: Uint8Array;
	/**
	 * Optional sliding doors, one value per cell. A door cell holds how far its door is open,
	 * from 0 (closed) to 1 (open). Every other cell holds NOT_A_DOOR. A door is a thin panel in
	 * the middle of its cell, across the passage: it is solid until it is fully open.
	 */
	doors?: Float32Array;
}

/** The `doors` value of a cell that has no door. */
export const NOT_A_DOOR = -1;

/** Returns the cell value at (x, y). Cells outside the grid count as solid. */
export function cellAt(grid: Grid, x: number, y: number): number {
	if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return OUTSIDE;
	return grid.cells[y * grid.width + x] as number;
}

/** Returns how far the door at (x, y) is open (0 to 1), or NOT_A_DOOR. */
export function doorAt(grid: Grid, x: number, y: number): number {
	if (!grid.doors || x < 0 || y < 0 || x >= grid.width || y >= grid.height) return NOT_A_DOOR;
	return grid.doors[y * grid.width + x] as number;
}

/** True when nothing can pass the cell: a wall, a door that is not fully open, or outside the grid. */
export function isSolid(grid: Grid, x: number, y: number): boolean {
	return cellAt(grid, x, y) !== 0 && doorAt(grid, x, y) < 1;
}

/** The cell value used for everything outside the grid. */
export const OUTSIDE = 1;
