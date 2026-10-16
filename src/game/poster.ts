import { rgb } from "../engine/framebuffer";
import { Face } from "../engine/raycast";
import type { Texture } from "../engine/texture";

/** Where the poster sits on its wall face, as fractions of the face (one tile wide and high). */
const POSTER_LEFT = 0.2;
const POSTER_RIGHT = 0.8;
const POSTER_TOP = 0.16;
const POSTER_BOTTOM = 0.7;
const FRAME_COLOR = rgb(24, 20, 16);
/** Shown when the Game core has no wall textures (in tests), so the poster still has a background. */
const NO_WALL = rgb(64, 64, 64);

/**
 * Makes the texture of one wall face with an Exhibit poster: the wall texture around a framed
 * poster. It is square (one tile) and uses the wall texture's texel size. The poster is scaled
 * to fit, and its transparent pixels show the wall. Call it once at startup.
 */
export function createPosterFace(
	wall: Texture | undefined,
	poster: Texture,
	x: number,
	y: number,
	face: Face,
): Texture {
	const size = wall?.height ?? 64;
	const texels = new Uint32Array(size * size);
	// The renderer maps a wall texture across faces by a coordinate u that grows from left to right
	// as the viewer sees the face. This is u at the left edge of this face, so the wall around the
	// poster lines up with the wall texture on the next cells.
	const leftU = face === Face.North ? -(x + 1) : face === Face.South ? x : face === Face.West ? y : -(y + 1);
	for (let fx = 0; fx < size; fx++) {
		for (let fy = 0; fy < size; fy++) {
			let texel = NO_WALL;
			if (wall) {
				const column = (((leftU * size + fx) % wall.width) + wall.width) % wall.width;
				texel = wall.texels[column * wall.height + fy] as number;
			}
			texels[fx * size + fy] = texel;
		}
	}

	const left = Math.round(POSTER_LEFT * size);
	const right = Math.round(POSTER_RIGHT * size);
	const top = Math.round(POSTER_TOP * size);
	const bottom = Math.round(POSTER_BOTTOM * size);
	const frame = Math.max(1, Math.round(size / 64));
	for (let fx = left; fx < right; fx++) {
		for (let fy = top; fy < bottom; fy++) texels[fx * size + fy] = FRAME_COLOR;
	}
	const innerWidth = right - left - 2 * frame;
	const innerHeight = bottom - top - 2 * frame;
	for (let ix = 0; ix < innerWidth; ix++) {
		const px = Math.floor(((ix + 0.5) * poster.width) / innerWidth);
		for (let iy = 0; iy < innerHeight; iy++) {
			const py = Math.floor(((iy + 0.5) * poster.height) / innerHeight);
			const texel = poster.texels[px * poster.height + py] as number;
			const index = (left + frame + ix) * size + top + frame + iy;
			// Pixels are 0xAABBGGRR: a mostly transparent poster pixel keeps the frame color.
			if (texel >>> 24 >= 128) texels[index] = texel;
		}
	}
	return { width: size, height: size, texels };
}
