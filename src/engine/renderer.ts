import type { Framebuffer } from "./framebuffer";
import { cellAt, type Grid } from "./grid";
import type { Texture } from "./texture";

export interface Camera {
	x: number;
	y: number;
	/** Radians. 0 faces +x, PI/2 faces +y (down the grid). */
	angle: number;
}

export interface RendererOptions {
	width: number;
	height: number;
	/**
	 * Wall texture for each grid cell value. A texture is one tile high, and its texels are square,
	 * so a 64x128 texture repeats twice across one tile and a 256x128 texture spans two tiles.
	 */
	wallTextures: ReadonlyArray<Texture | undefined>;
	/** Flat colors, shaded by distance like the walls. */
	ceilingColor: number;
	floorColor: number;
	/**
	 * Rows of the 3D view, from the top. The horizon is in the middle of them. Rows below it are
	 * left alone (for a status bar, for example). Default: the full height.
	 */
	viewHeight?: number;
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
/** Shown when a cell value has no wall texture, so the mistake is easy to see. */
const MISSING_TEXTURE: Texture = { width: 1, height: 1, texels: new Uint32Array([0xffff00ff]) };

/**
 * A raycaster: one ray per screen column, walked through the grid with DDA
 * (a digital differential analyzer: it steps from one cell edge to the next).
 */
export function createRenderer(options: RendererOptions): Renderer {
	const { width, height, wallTextures, ceilingColor, floorColor } = options;
	const viewHeight = options.viewHeight ?? height;
	if (viewHeight < 1 || viewHeight > height) throw new Error(`viewHeight must be 1 to ${height}, got ${viewHeight}.`);
	const planeHalfWidth = options.planeHalfWidth ?? 0.9;
	const shadeDistance = options.shadeDistance ?? 12;
	// Wall height on screen for a wall at distance 1, with square pixels.
	const projection = width / 2 / planeHalfWidth;
	const horizon = viewHeight / 2;
	const lightAt = (distance: number) => Math.max(MIN_SHADE, 1 - distance / shadeDistance);

	// The floor and ceiling are flat, so each row has one distance and one color. The eye is
	// half a tile above the floor, so a row `d` pixels from the horizon shows the floor (or
	// ceiling) at distance projection / 2 / d. Computed once here, so frames allocate nothing.
	const backgroundRows = new Uint32Array(viewHeight);
	for (let y = 0; y < viewHeight; y++) {
		const fromHorizon = Math.abs(y + 0.5 - horizon);
		const color = y < horizon ? ceilingColor : floorColor;
		backgroundRows[y] = shadeTexel(color, Math.round(lightAt(projection / 2 / fromHorizon) * 256));
	}

	return {
		render(framebuffer, grid, camera) {
			if (framebuffer.width !== width || framebuffer.height !== height) {
				throw new Error(
					`Renderer draws ${width}x${height}, but the framebuffer is ${framebuffer.width}x${framebuffer.height}.`,
				);
			}
			const pixels = framebuffer.pixels;
			for (let y = 0; y < viewHeight; y++) {
				pixels.fill(backgroundRows[y] as number, y * width, (y + 1) * width);
			}

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

				const texture = wallTextures[cell] ?? MISSING_TEXTURE;
				const { texels, height: textureHeight } = texture;
				// Where the ray hits along the wall face, in tiles. It grows from left to right as the
				// viewer sees the face, so textures never show mirrored.
				let u: number;
				if (ySide) {
					const hitX = camera.x + distance * rayX;
					u = rayY > 0 ? -hitX : hitX;
				} else {
					const hitY = camera.y + distance * rayY;
					u = rayX > 0 ? hitY : -hitY;
				}
				let textureX = Math.floor(u * textureHeight) % texture.width;
				if (textureX < 0) textureX += texture.width;
				const columnStart = textureX * textureHeight;

				const lineHeight = projection / distance;
				const wallTop = horizon - lineHeight / 2;
				const top = Math.max(0, Math.floor(wallTop));
				const bottom = Math.min(viewHeight, Math.ceil(horizon + lineHeight / 2));
				const textureStep = textureHeight / lineHeight;
				let textureY = (top + 0.5 - wallTop) * textureStep;

				let light = lightAt(distance);
				if (ySide) light *= Y_SIDE_SHADE;
				const level = Math.round(light * 256);
				for (let y = top, i = top * width + column; y < bottom; y++, i += width) {
					let row = textureY | 0;
					if (row >= textureHeight) row = textureHeight - 1;
					pixels[i] = shadeTexel(texels[columnStart + row] as number, level);
					textureY += textureStep;
				}
			}
		},
	};
}

/** Multiplies the color channels by `level` / 256 and keeps the pixel opaque. Allocates nothing. */
function shadeTexel(texel: number, level: number): number {
	const r = ((texel & 0xff) * level) >> 8;
	const g = (((texel >>> 8) & 0xff) * level) >> 8;
	const b = (((texel >>> 16) & 0xff) * level) >> 8;
	return (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
}
