/**
 * One-time script: extracts the Freedoom assets the game uses into PNG and WAV files.
 * The extracted files are committed, so the build never reads a WAD file.
 *
 * Usage (Node 24 or later runs TypeScript directly):
 *   node scripts/extract-freedoom.ts <unzipped freedoom-0.13.0 folder> [output folder]
 *
 * Source: https://github.com/freedoom/freedoom/releases/download/v0.13.0/freedoom-0.13.0.zip
 * (sha256 3f9b264f3e3ce503b4fb7f6bdcb1f419d93c7b546f4df3e874dd878db9688f59).
 * The default output folder is public/freedoom. The script only reads the WAD as data.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { crc32, deflateSync } from "node:zlib";

/** What the game uses. Change this list, then run the script again. */
const ASSETS = {
	/** Wall textures (TEXTURE1 names). DOOR3 and DOORTRAK are for doors (#7). */
	textures: ["STARTAN2", "STARTAN3", "COMP2", "TEKWALL1", "DOOR3", "DOORTRAK"],
	/** The Bug (#8): Freedoom's SKUL. A and B walk (front view), F to K die. */
	sprites: ["SKULA1", "SKULB1", "SKULF0", "SKULG0", "SKULH0", "SKULI0", "SKULJ0", "SKULK0"],
	/** Sound effects (#9): the shot and the door. */
	sounds: ["DSPISTOL", "DSDOROPN"],
	/** License files that must ship with the assets. */
	licenseFiles: ["COPYING.txt", "CREDITS.txt"],
};

interface Lump {
	name: string;
	data: Buffer;
}

interface Picture {
	width: number;
	height: number;
	leftOffset: number;
	topOffset: number;
	/** RGBA, row by row. Alpha 0 where the picture has no pixel. */
	rgba: Uint8Array;
}

function main(): void {
	const [sourceDir, outDir = "public/freedoom"] = process.argv.slice(2);
	if (!sourceDir) throw new Error("Usage: node scripts/extract-freedoom.ts <freedoom folder> [output folder]");

	const lumps = readWad(readFileSync(join(sourceDir, "freedoom1.wad")));
	const palette = findLump(lumps, "PLAYPAL").data.subarray(0, 768);
	const patchNames = readPatchNames(findLump(lumps, "PNAMES").data);
	const patches = lumpsBetween(lumps, "P_START", "P_END");
	const sprites = lumpsBetween(lumps, "S_START", "S_END");

	mkdirSync(join(outDir, "textures"), { recursive: true });
	mkdirSync(join(outDir, "sprites"), { recursive: true });
	mkdirSync(join(outDir, "sounds"), { recursive: true });

	for (const name of ASSETS.textures) {
		const texture = composeTexture(findTexture(lumps, name), patchNames, patches, palette);
		writePng(join(outDir, "textures", `${name}.png`), texture);
	}

	// PNG has no place for the sprite anchor, so the offsets go in one JSON file.
	const offsets: Record<string, { left: number; top: number }> = {};
	for (const name of ASSETS.sprites) {
		const lump = sprites.find((lump) => lump.name === name);
		if (!lump) throw new Error(`Sprite ${name} is not in the WAD.`);
		const picture = decodePicture(lump.data, palette);
		writePng(join(outDir, "sprites", `${name}.png`), picture);
		offsets[name] = { left: picture.leftOffset, top: picture.topOffset };
	}
	writeFileSync(join(outDir, "sprites", "offsets.json"), `${JSON.stringify(offsets, null, "\t")}\n`);

	for (const name of ASSETS.sounds) {
		writeFileSync(join(outDir, "sounds", `${name}.wav`), dmxToWav(findLump(lumps, name).data, name));
	}

	for (const file of ASSETS.licenseFiles) copyFileSync(join(sourceDir, file), join(outDir, file));
	console.log(`Extracted Freedoom assets into ${outDir}.`);
}

/** WAD: a 12-byte header ("IWAD", lump count, directory offset), then 16-byte directory entries. */
function readWad(wad: Buffer): Lump[] {
	const magic = wad.toString("latin1", 0, 4);
	if (magic !== "IWAD" && magic !== "PWAD") throw new Error(`Not a WAD file (magic "${magic}").`);
	const count = wad.readInt32LE(4);
	const directory = wad.readInt32LE(8);
	const lumps: Lump[] = [];
	for (let i = 0; i < count; i++) {
		const entry = directory + i * 16;
		const position = wad.readInt32LE(entry);
		const size = wad.readInt32LE(entry + 4);
		lumps.push({ name: readName(wad, entry + 8), data: wad.subarray(position, position + size) });
	}
	return lumps;
}

function readName(buffer: Buffer, offset: number): string {
	const raw = buffer.toString("latin1", offset, offset + 8);
	const end = raw.indexOf("\0");
	return (end === -1 ? raw : raw.slice(0, end)).toUpperCase();
}

/** Names repeat in a WAD; the first match is the one the game engine uses for non-sprite lumps. */
function findLump(lumps: Lump[], name: string): Lump {
	const lump = lumps.find((lump) => lump.name === name);
	if (!lump) throw new Error(`Lump ${name} is not in the WAD.`);
	return lump;
}

/** The lumps between two markers. Sub-markers (like PP_START) have no data and are skipped. */
function lumpsBetween(lumps: Lump[], start: string, end: string): Lump[] {
	const from = lumps.findIndex((lump) => lump.name === start || lump.name === `${start[0]}${start}`);
	const to = lumps.findIndex((lump, i) => i > from && (lump.name === end || lump.name === `${end[0]}${end}`));
	if (from === -1 || to === -1) throw new Error(`Markers ${start}..${end} are not in the WAD.`);
	return lumps.slice(from + 1, to).filter((lump) => lump.data.length > 0);
}

function readPatchNames(data: Buffer): string[] {
	const count = data.readInt32LE(0);
	return Array.from({ length: count }, (_, i) => readName(data, 4 + i * 8));
}

interface TextureDef {
	name: string;
	width: number;
	height: number;
	patches: { x: number; y: number; patch: number }[];
}

function findTexture(lumps: Lump[], name: string): TextureDef {
	for (const lumpName of ["TEXTURE1", "TEXTURE2"]) {
		const data = lumps.find((lump) => lump.name === lumpName)?.data;
		if (!data) continue;
		const count = data.readInt32LE(0);
		for (let i = 0; i < count; i++) {
			const offset = data.readInt32LE(4 + i * 4);
			if (readName(data, offset) !== name) continue;
			// maptexture_t: name, masked, width, height, unused, patch count, then 10-byte patches.
			const patchCount = data.readInt16LE(offset + 20);
			const patches = Array.from({ length: patchCount }, (_, p) => {
				const at = offset + 22 + p * 10;
				return { x: data.readInt16LE(at), y: data.readInt16LE(at + 2), patch: data.readInt16LE(at + 4) };
			});
			return { name, width: data.readInt16LE(offset + 12), height: data.readInt16LE(offset + 14), patches };
		}
	}
	throw new Error(`Texture ${name} is not in TEXTURE1 or TEXTURE2.`);
}

/** Draws each patch at its origin. Later patches cover earlier ones; patch holes cover nothing. */
function composeTexture(def: TextureDef, patchNames: string[], patches: Lump[], palette: Buffer): Picture {
	const rgba = new Uint8Array(def.width * def.height * 4);
	for (const placed of def.patches) {
		const patchName = patchNames[placed.patch];
		const lump = patches.find((lump) => lump.name === patchName);
		if (!lump) throw new Error(`Patch ${patchName} of texture ${def.name} is not in the WAD.`);
		const patch = decodePicture(lump.data, palette);
		for (let y = 0; y < patch.height; y++) {
			const ty = placed.y + y;
			if (ty < 0 || ty >= def.height) continue;
			for (let x = 0; x < patch.width; x++) {
				const tx = placed.x + x;
				if (tx < 0 || tx >= def.width) continue;
				const from = (y * patch.width + x) * 4;
				if (patch.rgba[from + 3] === 0) continue;
				rgba.set(patch.rgba.subarray(from, from + 4), (ty * def.width + tx) * 4);
			}
		}
	}
	for (let i = 3; i < rgba.length; i += 4) {
		if (rgba[i] === 0) throw new Error(`Texture ${def.name} has holes; a wall texture must be solid.`);
	}
	return { width: def.width, height: def.height, leftOffset: 0, topOffset: 0, rgba };
}

/**
 * Doom picture format: width, height, left offset, top offset (int16 each), one uint32 offset per column,
 * then each column is a list of posts (top row, length, pad, pixels, pad) that ends with 0xFF.
 */
function decodePicture(data: Buffer, palette: Buffer): Picture {
	const width = data.readInt16LE(0);
	const height = data.readInt16LE(2);
	const rgba = new Uint8Array(width * height * 4);
	for (let x = 0; x < width; x++) {
		let at = data.readUInt32LE(8 + x * 4);
		let top = -1;
		while (data[at] !== 0xff) {
			const delta = data[at] as number;
			// "Tall patches": a top row that is not below the last one counts from the last one.
			top = delta <= top ? top + delta : delta;
			const length = data[at + 1] as number;
			for (let i = 0; i < length; i++) {
				const y = top + i;
				if (y >= height) continue;
				const color = (data[at + 3 + i] as number) * 3;
				rgba.set(
					[palette[color] as number, palette[color + 1] as number, palette[color + 2] as number, 255],
					(y * width + x) * 4,
				);
			}
			at += length + 4;
		}
	}
	return { width, height, leftOffset: data.readInt16LE(4), topOffset: data.readInt16LE(6), rgba };
}

/** DMX sound: format 3, sample rate, sample count; 8-bit unsigned PCM with 16 pad bytes at each end. */
function dmxToWav(data: Buffer, name: string): Buffer {
	const format = data.readUInt16LE(0);
	if (format !== 3) throw new Error(`Sound ${name} has format ${format}, expected 3.`);
	const rate = data.readUInt16LE(2);
	const count = data.readUInt32LE(4);
	const samples = data.subarray(24, 8 + count - 16);
	const header = Buffer.alloc(44);
	header.write("RIFF", 0, "latin1");
	header.writeUInt32LE(36 + samples.length, 4);
	header.write("WAVEfmt ", 8, "latin1");
	header.writeUInt32LE(16, 16); // fmt chunk size
	header.writeUInt16LE(1, 20); // PCM
	header.writeUInt16LE(1, 22); // mono
	header.writeUInt32LE(rate, 24);
	header.writeUInt32LE(rate, 28); // bytes per second
	header.writeUInt16LE(1, 32); // block align
	header.writeUInt16LE(8, 34); // bits per sample (8-bit WAV is unsigned, like DMX)
	header.write("data", 36, "latin1");
	header.writeUInt32LE(samples.length, 40);
	return Buffer.concat([header, samples]);
}

/** A plain RGBA PNG: one IDAT chunk, filter 0 on each row. */
function writePng(path: string, picture: Picture): void {
	const { width, height, rgba } = picture;
	const raw = Buffer.alloc((width * 4 + 1) * height);
	for (let y = 0; y < height; y++) {
		raw[y * (width * 4 + 1)] = 0;
		raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
	}
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr.set([8, 6, 0, 0, 0], 8); // 8-bit, RGBA, deflate, no filter method, no interlace
	const png = Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk("IHDR", ihdr),
		chunk("IDAT", deflateSync(raw, { level: 9 })),
		chunk("IEND", Buffer.alloc(0)),
	]);
	writeFileSync(path, png);
}

function chunk(type: string, data: Buffer): Buffer {
	const typeAndData = Buffer.concat([Buffer.from(type, "latin1"), data]);
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(typeAndData));
	return Buffer.concat([length, typeAndData, crc]);
}

main();
