import type { Framebuffer } from "./framebuffer";
import { shade } from "./framebuffer";
import { cellAt, type Grid } from "./grid";

export interface Camera {
	x: number;
	y: number;
	/** Radians. 0 faces +x, PI/2 faces +y (down the grid). */
	angle: number;
	/** Moves the horizon down by this many screen pixels (negative moves it up). Default 0. */
	horizonOffset?: number;
}

export interface RendererOptions {
	width: number;
	height: number;
	/** Wall color for each grid cell value. */
	wallColors: Uint32Array;
	ceilingColor: number;
	floorColor: number;
	/** Half the width of the view plane, in tiles at distance 1. 1 gives a 90 degree field of view. */
	planeHalfWidth?: number;
	/** Walls at this distance (in tiles) or farther get the darkest shade. */
	shadeDistance?: number;
}

export interface Renderer {
	/** Draws one frame. It allocates no memory. */
	render(framebuffer: Framebuffer, grid: Grid, camera: Camera): void;
}

const MIN_SHADE = 0.15;
/** Walls that face north or south are a bit darker, so corners are easy to see. */
const Y_SIDE_SHADE = 0.75;
/** Shown when a cell value has no wall color, so the mistake is easy to see. */
const MISSING_COLOR = 0xffff00ff;

/**
 * A raycaster: one ray per screen column, walked through the grid with DDA
 * (a digital differential analyzer: it steps from one cell edge to the next).
 */
export function createRenderer(options: RendererOptions): Renderer {
	const { width, height, wallColors, ceilingColor, floorColor } = options;
	const planeHalfWidth = options.planeHalfWidth ?? 0.9;
	const shadeDistance = options.shadeDistance ?? 12;
	// Wall height on screen for a wall at distance 1, with square pixels.
	const projection = width / 2 / planeHalfWidth;

	return {
		render(framebuffer, grid, camera) {
			if (framebuffer.width !== width || framebuffer.height !== height) {
				throw new Error(
					`Renderer draws ${width}x${height}, but the framebuffer is ${framebuffer.width}x${framebuffer.height}.`,
				);
			}
			const pixels = framebuffer.pixels;
			const horizon = Math.min(height, Math.max(0, (height >> 1) + Math.round(camera.horizonOffset ?? 0)));
			pixels.fill(ceilingColor, 0, width * horizon);
			pixels.fill(floorColor, width * horizon);

			const dirX = Math.cos(camera.angle);
			const dirY = Math.sin(camera.angle);
			const planeX = -dirY * planeHalfWidth;
			const planeY = dirX * planeHalfWidth;

			for (let column = 0; column < width; column++) {
				const cameraX = (2 * (column + 0.5)) / width - 1;
				const rayX = dirX + planeX * cameraX;
				const rayY = dirY + planeY * cameraX;

				let mapX = Math.floor(camera.x);
				let mapY = Math.floor(camera.y);
				const deltaX = rayX === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / rayX);
				const deltaY = rayY === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / rayY);
				const stepX = rayX < 0 ? -1 : 1;
				const stepY = rayY < 0 ? -1 : 1;
				let sideX = (rayX < 0 ? camera.x - mapX : mapX + 1 - camera.x) * deltaX;
				let sideY = (rayY < 0 ? camera.y - mapY : mapY + 1 - camera.y) * deltaY;
				let ySide = false;
				let cell = 0;
				// Cells outside the grid are solid, so this loop always ends.
				while (cell === 0) {
					if (sideX < sideY) {
						sideX += deltaX;
						mapX += stepX;
						ySide = false;
					} else {
						sideY += deltaY;
						mapY += stepY;
						ySide = true;
					}
					cell = cellAt(grid, mapX, mapY);
				}
				// Distance along the view direction (not along the ray), so walls do not bulge.
				const distance = ySide ? sideY - deltaY : sideX - deltaX;

				const lineHeight = projection / distance;
				const top = Math.max(0, Math.floor(horizon - lineHeight / 2));
				const bottom = Math.min(height, Math.ceil(horizon + lineHeight / 2));
				let light = 1 - distance / shadeDistance;
				if (light < MIN_SHADE) light = MIN_SHADE;
				if (ySide) light *= Y_SIDE_SHADE;
				const color = shade(wallColors[cell] ?? MISSING_COLOR, light);
				for (let y = top, i = top * width + column; y < bottom; y++, i += width) {
					pixels[i] = color;
				}
			}
		},
	};
}
