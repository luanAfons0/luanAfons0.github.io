import { crc32, deflateSync } from "node:zlib";
import type { Pixmap } from "./pixmap.ts";

/** The provenance each generated file carries in its metadata. */
export const GENERATOR = "scripts/machine-art.ts";

/** One file the generator writes: its path inside the machine art folder and its bytes. */
export interface GeneratedFile {
	path: string;
	bytes: Buffer;
}

/**
 * A PNG file of a pixmap: 8-bit RGBA, one IDAT chunk, filter 0 on each row, and a `Software`
 * text chunk that names the generator. Transparent pixels get alpha 0. `texts` adds more text
 * chunks (keyword and Latin-1 text), such as a `Title`.
 */
export function pngFile(path: string, pixmap: Pixmap, texts: Readonly<Record<string, string>> = {}): GeneratedFile {
	const { width, height, pixels } = pixmap;
	const stride = width * 4 + 1;
	const raw = Buffer.alloc(stride * height);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const color = pixels[y * width + x] as number;
			const at = y * stride + 1 + x * 4;
			if (color < 0) continue;
			raw[at] = (color >> 16) & 255;
			raw[at + 1] = (color >> 8) & 255;
			raw[at + 2] = color & 255;
			raw[at + 3] = 255;
		}
	}
	const header = Buffer.alloc(13);
	header.writeUInt32BE(width, 0);
	header.writeUInt32BE(height, 4);
	header.set([8, 6, 0, 0, 0], 8); // 8-bit, RGBA, deflate, no filter method, no interlace
	const bytes = Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk("IHDR", header),
		chunk("tEXt", Buffer.from(`Software\0${GENERATOR}`, "latin1")),
		...Object.entries(texts).map(([keyword, value]) => chunk("tEXt", Buffer.from(`${keyword}\0${value}`, "latin1"))),
		chunk("IDAT", deflateSync(raw, { level: 9 })),
		chunk("IEND", Buffer.alloc(0)),
	]);
	return { path, bytes };
}

function chunk(type: string, data: Buffer): Buffer {
	const typeAndData = Buffer.concat([Buffer.from(type, "latin1"), data]);
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(typeAndData));
	return Buffer.concat([length, typeAndData, crc]);
}
