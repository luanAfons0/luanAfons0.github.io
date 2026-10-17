import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { inflateSync } from "node:zlib";
import { afterAll, describe, expect, it } from "vitest";
import { MACHINE_ART_SET } from "../src/game/theme.ts";
import { generateMachineArt, MACHINE_ART_FOLDER } from "./machine-art.ts";

const runs: string[] = [];

/** Runs the generator into a new temp folder and returns the folder and the files it wrote. */
function generate(): { folder: string; files: string[] } {
	const folder = mkdtempSync(join(tmpdir(), "machine-art-"));
	runs.push(folder);
	return { folder, files: generateMachineArt(folder) };
}

afterAll(() => {
	for (const folder of runs) rmSync(folder, { recursive: true, force: true });
});

/** The text chunks (keyword and text) of a PNG file, and its image data before compression. */
function readPng(png: Buffer): { texts: Record<string, string>; data: Buffer } {
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

/** The same file content. PNGs compare by image data and text, as another zlib may compress them differently. */
function sameContent(file: string, a: Buffer, b: Buffer): boolean {
	if (!file.endsWith(".png")) return a.equals(b);
	const [pngA, pngB] = [readPng(a), readPng(b)];
	return pngA.data.equals(pngB.data) && JSON.stringify(pngA.texts) === JSON.stringify(pngB.texts);
}

/** A folder of the art set (under `public/`) as a path inside the machine art folder. */
function inMachineFolder(folder: string): string {
	const inside = relative(MACHINE_ART_FOLDER, join("public", folder));
	expect(inside.startsWith(".."), `${folder} is not in ${MACHINE_ART_FOLDER}`).toBe(false);
	return inside;
}

describe("machine art generator", () => {
	it("writes the four wall textures and the door track", () => {
		const { files } = generate();
		expect(files).toEqual(
			expect.arrayContaining([
				"textures/board-a.png",
				"textures/board-b.png",
				"textures/chip.png",
				"textures/rack.png",
				"textures/door.png",
				"textures/door-track.png",
			]),
		);
	});

	it("writes every Bug frame of the art set into its sprites folder, each with an anchor", () => {
		const { folder, files } = generate();
		const sprites = inMachineFolder(MACHINE_ART_SET.folders.sprites);
		const offsets = JSON.parse(readFileSync(join(folder, sprites, "offsets.json"), "utf8"));
		const frames = [...MACHINE_ART_SET.bugWalkFrames, ...MACHINE_ART_SET.bugFixFrames];

		expect(MACHINE_ART_SET.bugWalkFrames).toHaveLength(2);
		for (const name of frames) {
			expect(files).toContain(`${sprites}/${name}.png`);
			expect(offsets[name]).toEqual({ left: expect.any(Number), top: expect.any(Number) });
		}
	});

	it("gives byte-identical files when it runs twice", () => {
		const first = generate();
		const second = generate();
		expect(second.files).toEqual(first.files);
		for (const file of first.files) {
			expect(readFileSync(join(second.folder, file)).equals(readFileSync(join(first.folder, file)))).toBe(true);
		}
	});

	it("matches the committed files, so the build needs no generation step", () => {
		const { folder, files } = generate();
		for (const file of files) {
			const committed = readFileSync(join(import.meta.dirname, "..", MACHINE_ART_FOLDER, file));
			const generated = readFileSync(join(folder, file));
			expect(sameContent(file, committed, generated), `${file} is out of date: run the generator`).toBe(true);
		}
	});

	it("names the generator as the provenance of each PNG", () => {
		const { folder, files } = generate();
		for (const file of files.filter((file) => file.endsWith(".png"))) {
			expect(readPng(readFileSync(join(folder, file))).texts).toMatchObject({ Software: "scripts/machine-art.ts" });
		}
	});
});
