/** Readers of generated files, for the generator tests. */
import { inflateSync } from "node:zlib";

/** The text chunks (keyword and text) of a PNG file, and its image data before compression. */
export function readPng(png: Buffer): { texts: Record<string, string>; data: Buffer } {
	const texts: Record<string, string> = {};
	const compressed: Buffer[] = [];
	for (let at = 8; at < png.length; ) {
		const length = png.readUInt32BE(at);
		const type = png.toString("latin1", at + 4, at + 8);
		const body = png.subarray(at + 8, at + 8 + length);
		if (type === "tEXt") {
			const [keyword = "", text = ""] = body.toString("latin1").split("\0");
			texts[keyword] = text;
		}
		if (type === "IDAT") compressed.push(body);
		at += 12 + length;
	}
	return { texts, data: inflateSync(Buffer.concat(compressed)) };
}

/** The size of a PNG, from its header. */
export function pngSize(png: Buffer): [width: number, height: number] {
	return [png.readUInt32BE(16), png.readUInt32BE(20)];
}

/** The same file content. PNGs compare by image data and text, as another zlib may compress them differently. */
export function sameContent(file: string, a: Buffer, b: Buffer): boolean {
	if (!file.endsWith(".png")) return a.equals(b);
	const [pngA, pngB] = [readPng(a), readPng(b)];
	return pngA.data.equals(pngB.data) && JSON.stringify(pngA.texts) === JSON.stringify(pngB.texts);
}
