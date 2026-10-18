import type { Framebuffer } from "./framebuffer";
import type { Grid } from "./grid";
import { createRayHit, Face, faceKey, walkRay } from "./raycast";
import type { Texture } from "./texture";

export interface Camera {
	x: number;
	y: number;
	/** Radians. 0 faces +x, PI/2 faces +y (down the grid). */
	angle: number;
	/** Moves the horizon down by this many screen pixels (negative moves it up). Default 0. */
	horizonOffset?: number;
}

/** A sprite picture with its anchor, like a Doom sprite lump. Texels with alpha 0 are see-through. */
export interface SpriteImage {
	texture: Texture;
	/** The anchor is this many texels right of the left edge... */
	left: number;
	/** ...and this many texels below the top edge. */
	top: number;
}

/** A billboard: a flat picture that always faces the camera. Positions are in tiles. */
export interface Sprite {
	x: number;
	y: number;
	/** The height of the anchor above the floor, in tiles. The floor is at 0 and the ceiling at 1. */
	z: number;
	image: SpriteImage;
}

export interface RendererOptions {
	width: number;
	height: number;
	/**
	 * Wall texture for each grid cell value. A texture is one tile high, and its texels are square,
	 * so a 64x128 texture repeats twice across one tile and a 256x128 texture spans two tiles.
	 */
	wallTextures: ReadonlyArray<Texture | undefined>;
	/**
	 * Textures for single wall faces, by `faceKey`. They replace the wall texture on that face
	 * and span exactly one tile across, whatever their size (for posters, for example).
	 */
	faceTextures?: ReadonlyMap<number, Texture>;
	/**
	 * For each door cell value: the track texture of the side walls of the door cell.
	 * The door panel itself uses `wallTextures`, stretched to exactly one tile wide.
	 */
	trackTextures?: ReadonlyArray<Texture | undefined>;
	/**
	 * The textures of the ceiling and the floor (Doom's "flats"). A flat covers exactly one tile and
	 * repeats on every tile, so its texel (x, y) is at the same spot of every tile, seen from above.
	 * It is shaded by distance like the walls. With no flat, that surface shows its flat color.
	 */
	ceilingFlat?: Texture;
	floorFlat?: Texture;
	/** Flat colors, shaded by distance like the walls, for a surface with no flat texture. */
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
	/** The size of one sprite texel, in tiles. Default 1/128, the size of a wall texel. */
	spriteTexelSize?: number;
}

export interface Renderer {
	/**
	 * Draws one frame: the ceiling and the floor, the walls, then the first `spriteCount` sprites
	 * (default: all), far to near.
	 * Walls in front of a sprite hide it. It allocates no memory, except once when a frame has
	 * more sprites than any frame before. A door cell (see `Grid.doors`) shows a thin panel in the
	 * middle of the cell, slid aside by its open amount, and the track texture on its side walls.
	 */
	render(
		framebuffer: Framebuffer,
		grid: Grid,
		camera: Camera,
		sprites?: ReadonlyArray<Sprite>,
		spriteCount?: number,
	): void;
}

const MIN_SHADE = 0.15;
/** Walls that face north or south are a bit darker, so corners are easy to see. */
const Y_SIDE_SHADE = 0.75;
/** Shown when a cell value has no wall texture, so the mistake is easy to see. */
const MISSING_TEXTURE: Texture = { width: 1, height: 1, texels: new Uint32Array([0xffff00ff]) };
/** Sprites nearer than this (in tiles) are not drawn: they would fill the view. */
const NEAR_PLANE = 0.1;
const NO_SPRITES: ReadonlyArray<Sprite> = [];
/**
 * Floor casting adds this many whole tiles to world points, so they are never negative. The farthest
 * floor row is about `projection` tiles away (a few hundred), so this keeps every point positive.
 */
const FLAT_OFFSET = 4096;

/** A raycaster: one ray per screen column, walked through the grid with `walkRay`. */
export function createRenderer(options: RendererOptions): Renderer {
	const { width, height, wallTextures, faceTextures, ceilingFlat, floorFlat, ceilingColor, floorColor } = options;
	const trackTextures = options.trackTextures ?? [];
	const viewHeight = options.viewHeight ?? height;
	if (viewHeight < 1 || viewHeight > height) throw new Error(`viewHeight must be 1 to ${height}, got ${viewHeight}.`);
	const planeHalfWidth = options.planeHalfWidth ?? 0.9;
	const shadeDistance = options.shadeDistance ?? 12;
	const spriteTexelSize = options.spriteTexelSize ?? 1 / 128;
	// Wall height on screen for a wall at distance 1, with square pixels.
	const projection = width / 2 / planeHalfWidth;
	const lightAt = (distance: number) => Math.max(MIN_SHADE, 1 - distance / shadeDistance);

	// The floor and ceiling are flat, so each row has one distance and one light level. The eye is
	// half a tile above the floor, so the row k rows away from the horizon shows the floor (or
	// ceiling) at distance projection / 2 / (k + 0.5). Computed once here, so frames allocate nothing.
	const rowDistances = new Float64Array(viewHeight);
	const rowLevels = new Int32Array(viewHeight);
	const ceilingRows = new Uint32Array(viewHeight);
	const floorRows = new Uint32Array(viewHeight);
	for (let k = 0; k < viewHeight; k++) {
		const distance = projection / 2 / (k + 0.5);
		const level = Math.round(lightAt(distance) * 256);
		rowDistances[k] = distance;
		rowLevels[k] = level;
		ceilingRows[k] = shadeTexel(ceilingColor, level);
		floorRows[k] = shadeTexel(floorColor, level);
	}
	// The wall distance of each column, so sprites behind a wall are hidden.
	const depthBuffer = new Float64Array(width);
	// Reused by every ray, so frames allocate nothing.
	const hit = createRayHit();
	// The sprites of one frame, sorted far to near. They grow only when a frame has more sprites than before.
	let spriteOrder = new Int32Array(16);
	let spriteDepths = new Float64Array(16);

	return {
		render(framebuffer, grid, camera, sprites = NO_SPRITES, spriteCount = sprites.length) {
			if (framebuffer.width !== width || framebuffer.height !== height) {
				throw new Error(
					`Renderer draws ${width}x${height}, but the framebuffer is ${framebuffer.width}x${framebuffer.height}.`,
				);
			}
			const pixels = framebuffer.pixels;
			const horizon = Math.min(viewHeight, Math.max(0, (viewHeight >> 1) + Math.round(camera.horizonOffset ?? 0)));
			const dirX = Math.cos(camera.angle);
			const dirY = Math.sin(camera.angle);
			const planeX = -dirY * planeHalfWidth;
			const planeY = dirX * planeHalfWidth;

			// The ceiling and the floor, row by row. The walls and the sprites draw over them.
			for (let y = 0; y < viewHeight; y++) {
				const isCeiling = y < horizon;
				const k = isCeiling ? horizon - 1 - y : y - horizon;
				const flat = isCeiling ? ceilingFlat : floorFlat;
				const rowStart = y * width;
				if (!flat) {
					pixels.fill((isCeiling ? ceilingRows[k] : floorRows[k]) as number, rowStart, rowStart + width);
					continue;
				}
				// Floor casting: the row shows the floor (or ceiling) at one distance, from the left edge ray
				// to the right edge ray. Step across it in world space, one pixel center at a time.
				const distance = rowDistances[k] as number;
				const level = rowLevels[k] as number;
				const { texels, width: flatWidth, height: flatHeight } = flat;
				// The world point is in texels, moved by whole tiles so it is never negative and `| 0` rounds it down.
				const stepX = (distance * 2 * planeX * flatWidth) / width;
				const stepY = (distance * 2 * planeY * flatHeight) / width;
				let texelX = (FLAT_OFFSET + camera.x + distance * (dirX - planeX)) * flatWidth + stepX / 2;
				let texelY = (FLAT_OFFSET + camera.y + distance * (dirY - planeY)) * flatHeight + stepY / 2;
				for (let i = rowStart, end = rowStart + width; i < end; i++) {
					const textureX = (texelX | 0) % flatWidth;
					const textureY = (texelY | 0) % flatHeight;
					pixels[i] = shadeTexel(texels[textureX * flatHeight + textureY] as number, level);
					texelX += stepX;
					texelY += stepY;
				}
			}

			for (let column = 0; column < width; column++) {
				const cameraX = (2 * (column + 0.5)) / width - 1;
				const rayX = dirX + planeX * cameraX;
				const rayY = dirY + planeY * cameraX;
				// The ray is the view direction plus a part of the view plane, so its hit distance is the
				// distance along the view direction (not along the ray), and walls do not bulge.
				walkRay(grid, camera.x, camera.y, rayX, rayY, Number.POSITIVE_INFINITY, hit);
				const distance = hit.distance;
				const ySide = hit.face === Face.North || hit.face === Face.South;
				let texture: Texture;
				let textureX: number;
				if (hit.door) {
					// The door panel shows the door texture, stretched to exactly one tile wide.
					texture = wallTextures[hit.cell] ?? MISSING_TEXTURE;
					textureX = Math.min(texture.width - 1, Math.floor(hit.doorU * texture.width));
				} else {
					const { x, y } = hit;
					const inGrid = x >= 0 && y >= 0 && x < grid.width && y < grid.height;
					const faceTexture = faceTextures && inGrid ? faceTextures.get(faceKey(grid, x, y, hit.face)) : undefined;
					// A wall seen from inside a door cell is a side wall of the door: it shows the track.
					texture =
						faceTexture ??
						(hit.insideDoor === 0 ? wallTextures[hit.cell] : trackTextures[hit.insideDoor]) ??
						MISSING_TEXTURE;
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
					textureX = faceTexture
						? Math.floor((u - Math.floor(u)) * texture.width)
						: Math.floor(u * texture.height) % texture.width;
					if (textureX < 0) textureX += texture.width;
				}
				depthBuffer[column] = distance;
				const { texels, height: textureHeight } = texture;
				const columnStart = textureX * textureHeight;

				const lineHeight = projection / distance;
				const wallTop = horizon - lineHeight / 2;
				// A row shows the wall when its pixel center is on the wall (the same rule as sprites),
				// so the first row never reads above the first texture row.
				const top = Math.max(0, Math.ceil(wallTop - 0.5));
				const bottom = Math.min(viewHeight, Math.ceil(horizon + lineHeight / 2 - 0.5));
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

			// Sprites: sort far to near, so nearer sprites cover farther ones.
			if (spriteCount > spriteOrder.length) {
				spriteOrder = new Int32Array(spriteCount);
				spriteDepths = new Float64Array(spriteCount);
			}
			let visible = 0;
			for (let i = 0; i < spriteCount; i++) {
				const sprite = sprites[i] as Sprite;
				// Depth along the view direction, like the wall distance.
				const depth = (sprite.x - camera.x) * dirX + (sprite.y - camera.y) * dirY;
				if (depth < NEAR_PLANE) continue;
				// Insertion sort: shift nearer sprites right, then put this one in the gap.
				let slot = visible++;
				while (slot > 0 && (spriteDepths[slot - 1] as number) < depth) {
					spriteDepths[slot] = spriteDepths[slot - 1] as number;
					spriteOrder[slot] = spriteOrder[slot - 1] as number;
					slot--;
				}
				spriteDepths[slot] = depth;
				spriteOrder[slot] = i;
			}
			for (let k = 0; k < visible; k++) {
				const sprite = sprites[spriteOrder[k] as number] as Sprite;
				const depth = spriteDepths[k] as number;
				const { texture, left, top } = sprite.image;
				const { texels, width: textureWidth, height: textureHeight } = texture;
				// Screen pixels per sprite texel at this depth.
				const texelPixels = (projection / depth) * spriteTexelSize;
				// Where the sprite is across the view: -1 at the left edge, 1 at the right edge.
				const across =
					((sprite.x - camera.x) * planeX + (sprite.y - camera.y) * planeY) / (planeHalfWidth * planeHalfWidth) / depth;
				const screenLeft = ((across + 1) * width) / 2 - left * texelPixels;
				const screenTop = horizon + ((0.5 - sprite.z) * projection) / depth - top * texelPixels;
				const firstColumn = Math.max(0, Math.ceil(screenLeft - 0.5));
				const endColumn = Math.min(width, Math.ceil(screenLeft + textureWidth * texelPixels - 0.5));
				const firstRow = Math.max(0, Math.ceil(screenTop - 0.5));
				const endRow = Math.min(viewHeight, Math.ceil(screenTop + textureHeight * texelPixels - 0.5));
				const level = Math.round(lightAt(depth) * 256);
				for (let column = firstColumn; column < endColumn; column++) {
					if (depth >= (depthBuffer[column] as number)) continue;
					const textureX = Math.min(textureWidth - 1, ((column + 0.5 - screenLeft) / texelPixels) | 0);
					const columnStart = textureX * textureHeight;
					for (let y = firstRow, i = firstRow * width + column; y < endRow; y++, i += width) {
						const row = Math.min(textureHeight - 1, ((y + 0.5 - screenTop) / texelPixels) | 0);
						const texel = texels[columnStart + row] as number;
						if (texel >>> 24 !== 0) pixels[i] = shadeTexel(texel, level);
					}
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
