/**
 * A block of pixels the renderer writes into. Each pixel is one 32-bit value.
 * On little-endian machines (every target browser), its bytes are R, G, B, A,
 * so `pixels.buffer` can go straight into an `ImageData`.
 */
export interface Framebuffer {
	width: number;
	height: number;
	pixels: Uint32Array<ArrayBuffer>;
}

export function createFramebuffer(width: number, height: number): Framebuffer {
	return { width, height, pixels: new Uint32Array(width * height) };
}

/** Packs an opaque color into a framebuffer pixel (0xAABBGGRR). */
export function rgb(r: number, g: number, b: number): number {
	return ((0xff << 24) | ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff)) >>> 0;
}

/** Multiplies the color channels of a pixel by `factor` (0 to 1) and keeps it opaque. */
export function shade(pixel: number, factor: number): number {
	return rgb((pixel & 0xff) * factor, ((pixel >>> 8) & 0xff) * factor, ((pixel >>> 16) & 0xff) * factor);
}
