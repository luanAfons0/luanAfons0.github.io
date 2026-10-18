import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { crc32, deflateSync } from "node:zlib";
import type { Pixmap } from "./pixmap.ts";

/** One file a generator writes: its path inside the output folder and its bytes. */
export interface GeneratedFile {
	path: string;
	bytes: Buffer;
}

/** Writes `files` into `outDir`, with their folders. Returns their paths inside `outDir`, sorted. */
export function writeFiles(outDir: string, files: readonly GeneratedFile[]): string[] {
	for (const { path, bytes } of files) {
		mkdirSync(dirname(join(outDir, path)), { recursive: true });
		writeFileSync(join(outDir, path), bytes);
	}
	return files.map(({ path }) => path).sort();
}

/** The sample rate of every generated sound, in samples per second. */
export const SAMPLE_RATE = 22050;

/** The file writers of one generator. */
export interface FileWriters {
	pngFile(path: string, pixmap: Pixmap, texts?: Readonly<Record<string, string>>): GeneratedFile;
	wavFile(path: string, samples: Float32Array): GeneratedFile;
}

/**
 * The PNG and WAV writers for the generator script at `generator`, such as `scripts/machine-art.ts`.
 * Each file names that script in its metadata.
 */
export function fileWriters(generator: string): FileWriters {
	return {
		pngFile: (path, pixmap, texts) => pngFile(generator, path, pixmap, texts),
		wavFile: (path, samples) => wavFile(generator, path, samples),
	};
}

/**
 * A PNG file of a pixmap: 8-bit RGBA, one IDAT chunk, filter 0 on each row, and a `Software`
 * text chunk that names the generator. Transparent pixels get alpha 0. `texts` adds more text
 * chunks (keyword and Latin-1 text), such as a `Title`.
 */
function pngFile(
	generator: string,
	path: string,
	pixmap: Pixmap,
	texts: Readonly<Record<string, string>> = {},
): GeneratedFile {
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
		chunk("tEXt", Buffer.from(`Software\0${generator}`, "latin1")),
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

/**
 * A WAV file of mono samples from -1 to 1: 16-bit PCM at `SAMPLE_RATE`, with a `LIST` `INFO`
 * chunk whose `ISFT` (software) text names the generator. Samples outside -1 to 1 are clipped.
 */
function wavFile(generator: string, path: string, samples: Float32Array): GeneratedFile {
	const format = Buffer.alloc(16);
	format.writeUInt16LE(1, 0); // PCM
	format.writeUInt16LE(1, 2); // mono
	format.writeUInt32LE(SAMPLE_RATE, 4);
	format.writeUInt32LE(SAMPLE_RATE * 2, 8); // bytes per second
	format.writeUInt16LE(2, 12); // bytes per sample frame
	format.writeUInt16LE(16, 14); // bits per sample
	const data = Buffer.alloc(samples.length * 2);
	for (const [i, sample] of samples.entries()) {
		data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), i * 2);
	}
	const info = Buffer.concat([
		Buffer.from("INFO", "latin1"),
		riffChunk("ISFT", Buffer.from(`${generator}\0`, "latin1")),
	]);
	const body = Buffer.concat([
		Buffer.from("WAVE", "latin1"),
		riffChunk("fmt ", format),
		riffChunk("LIST", info),
		riffChunk("data", data),
	]);
	return { path, bytes: riffChunk("RIFF", body) };
}

/** A RIFF chunk: its id, its little-endian length, its data, and a pad byte when the length is odd. */
function riffChunk(id: string, data: Buffer): Buffer {
	const length = Buffer.alloc(4);
	length.writeUInt32LE(data.length);
	const pad = Buffer.alloc(data.length % 2);
	return Buffer.concat([Buffer.from(id, "latin1"), length, data, pad]);
}
