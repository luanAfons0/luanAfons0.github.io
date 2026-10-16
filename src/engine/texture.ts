/**
 * A decoded image the renderer samples. Texels use the framebuffer pixel format (0xAABBGGRR).
 * They are stored column by column (texel (x, y) is at `x * height + y`), because the renderer
 * draws walls one screen column at a time.
 */
export interface Texture {
	width: number;
	height: number;
	texels: Uint32Array;
}

/** Makes a texture from RGBA bytes stored row by row, like `ImageData.data`. */
export function createTexture(width: number, height: number, rgba: Uint8Array | Uint8ClampedArray): Texture {
	if (rgba.length !== width * height * 4) {
		throw new Error(`A ${width}x${height} texture needs ${width * height * 4} RGBA bytes, got ${rgba.length}.`);
	}
	const rows = new Uint32Array(rgba.buffer, rgba.byteOffset, width * height);
	const texels = new Uint32Array(width * height);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			texels[x * height + y] = rows[y * width + x] as number;
		}
	}
	return { width, height, texels };
}

/**
 * Fetches and decodes an image into a texture. Call it once at startup, not during a frame.
 * Browser only: it needs `createImageBitmap` and `OffscreenCanvas`.
 */
export async function loadTexture(url: string): Promise<Texture> {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`Cannot load texture ${url}: HTTP ${response.status}.`);
	const bitmap = await createImageBitmap(await response.blob());
	const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
	const context = canvas.getContext("2d");
	if (!context) throw new Error("OffscreenCanvas has no 2D context.");
	context.drawImage(bitmap, 0, 0);
	bitmap.close();
	const image = context.getImageData(0, 0, canvas.width, canvas.height);
	return createTexture(image.width, image.height, image.data);
}
