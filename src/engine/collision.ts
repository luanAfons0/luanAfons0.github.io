import { cellAt, type Grid } from "./grid";

export interface Position {
	x: number;
	y: number;
}

/**
 * Moves a circle by (dx, dy) through the grid and pushes it out of solid cells.
 * The push goes along the wall normal only, so the circle slides along walls.
 * It changes `position` in place and allocates nothing.
 */
export function moveCircle(grid: Grid, position: Position, dx: number, dy: number, radius: number): void {
	// Small sub-steps so a fast move cannot pass through a thin wall.
	const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (radius * 0.5)));
	for (let i = 0; i < steps; i++) {
		position.x += dx / steps;
		position.y += dy / steps;
		pushOut(grid, position, radius);
	}
}

function pushOut(grid: Grid, position: Position, radius: number): void {
	const minX = Math.floor(position.x - radius);
	const maxX = Math.floor(position.x + radius);
	const minY = Math.floor(position.y - radius);
	const maxY = Math.floor(position.y + radius);
	for (let cy = minY; cy <= maxY; cy++) {
		for (let cx = minX; cx <= maxX; cx++) {
			if (cellAt(grid, cx, cy) === 0) continue;
			// Closest point of the cell square to the circle center.
			const nearestX = clamp(position.x, cx, cx + 1);
			const nearestY = clamp(position.y, cy, cy + 1);
			const offX = position.x - nearestX;
			const offY = position.y - nearestY;
			const distance = Math.hypot(offX, offY);
			if (distance >= radius) continue;
			if (distance > 0) {
				const push = (radius - distance) / distance;
				position.x += offX * push;
				position.y += offY * push;
			} else {
				// The center is inside the cell: leave by the nearest face.
				pushOutOfCell(position, cx, cy, radius);
			}
		}
	}
}

function pushOutOfCell(position: Position, cx: number, cy: number, radius: number): void {
	const left = position.x - cx;
	const right = cx + 1 - position.x;
	const top = position.y - cy;
	const bottom = cy + 1 - position.y;
	const nearest = Math.min(left, right, top, bottom);
	if (nearest === left) position.x = cx - radius;
	else if (nearest === right) position.x = cx + 1 + radius;
	else if (nearest === top) position.y = cy - radius;
	else position.y = cy + 1 + radius;
}

function clamp(value: number, min: number, max: number): number {
	return value < min ? min : value > max ? max : value;
}
