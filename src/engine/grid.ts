/**
 * A 2D grid of cells, stored row by row. A cell value of 0 is empty.
 * Any other value is solid, and the renderer uses it to pick the wall color.
 */
export interface Grid {
	width: number;
	height: number;
	cells: Uint8Array;
}

/** Returns the cell value at (x, y). Cells outside the grid count as solid. */
export function cellAt(grid: Grid, x: number, y: number): number {
	if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return OUTSIDE;
	return grid.cells[y * grid.width + x] as number;
}

/** The cell value used for everything outside the grid. */
export const OUTSIDE = 1;
