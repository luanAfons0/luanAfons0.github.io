import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { EXHIBITS, type Exhibit, partLabel } from "../src/game/content.ts";
import { MACHINE_ART_SET } from "../src/game/theme.ts";
import { pngSize, readPng, sameContent } from "./art-kit/read-files.ts";
import { posters } from "./machine-art/posters.ts";
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

	it("writes the ceiling Flat and the floor Flat of the art set into its textures folder, 64x64", () => {
		const { folder, files } = generate();
		const textures = inMachineFolder(MACHINE_ART_SET.folders.textures);
		const { ceiling, floor } = MACHINE_ART_SET.flats;

		for (const name of [ceiling, floor]) {
			const file = `${textures}/${name}.png`;
			expect(files).toContain(file);
			expect(pngSize(readFileSync(join(folder, file))), file).toEqual([64, 64]);
		}
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

	it("writes every sound of the art set as a mono 16-bit WAV that names the generator", () => {
		const { folder, files } = generate();
		const soundsFolder = inMachineFolder(MACHINE_ART_SET.folders.sounds);

		for (const name of Object.values(MACHINE_ART_SET.sounds)) {
			const file = `${soundsFolder}/${name}.wav`;
			expect(files).toContain(file);
			const wav = readFileSync(join(folder, file));
			expect(wav.toString("latin1", 0, 4) + wav.toString("latin1", 8, 12), file).toBe("RIFFWAVE");
			expect(wav.readUInt32LE(4), file).toBe(wav.length - 8);
			expect([wav.readUInt16LE(20), wav.readUInt16LE(22), wav.readUInt16LE(34)], file).toEqual([1, 1, 16]);
			expect(wav.toString("latin1"), file).toContain("ISFT");
			expect(wav.toString("latin1"), file).toContain("scripts/machine-art.ts");
		}
	});

	it("gives the same bytes when it runs twice in one process", () => {
		const first = generate();
		const second = generate();
		expect(second.files).toEqual(first.files);
		for (const file of first.files) {
			expect(readFileSync(join(second.folder, file)).equals(readFileSync(join(first.folder, file)))).toBe(true);
		}
	});

	it("matches the committed files (PNGs by image data and text), so the build needs no generation step", () => {
		const { folder, files } = generate();
		for (const file of files) {
			const committed = readFileSync(join(import.meta.dirname, "..", MACHINE_ART_FOLDER, file));
			const generated = readFileSync(join(folder, file));
			expect(sameContent(file, committed, generated), `${file} is out of date: run the generator`).toBe(true);
		}
	});

	it("commits exactly the files it writes, and no other file", () => {
		const { files } = generate();
		const artFolder = join(import.meta.dirname, "..", MACHINE_ART_FOLDER);
		const committed = readdirSync(artFolder, { recursive: true, withFileTypes: true })
			.filter((entry) => entry.isFile())
			.map((entry) => relative(artFolder, join(entry.parentPath, entry.name)))
			.sort();
		expect(committed, "the committed art folder must hold exactly the files the generator writes").toEqual(files);
	});

	it("names the generator as the provenance of each PNG", () => {
		const { folder, files } = generate();
		for (const file of files.filter((file) => file.endsWith(".png"))) {
			expect(readPng(readFileSync(join(folder, file))).texts).toMatchObject({ Software: "scripts/machine-art.ts" });
		}
	});
});

describe("Exhibit posters", () => {
	/** A sample Exhibit of a kind. */
	const exhibit = (id: string, kind: Exhibit["kind"]): Exhibit => ({
		id,
		kind,
		title: `Title of ${id}`,
		summary: "",
		details: [],
		links: [],
	});

	it("draws one poster per Exhibit of the Content, named by its id in the posters folder", () => {
		const { files } = generate();
		for (const { id } of EXHIBITS) expect(files, id).toContain(`posters/${id}.png`);
	});

	it("names each poster by the Part label the Skip View and the Exhibit Panel show", () => {
		const { folder } = generate();
		for (const exhibit of EXHIBITS) {
			const png = readFileSync(join(folder, `posters/${exhibit.id}.png`));
			expect(readPng(png).texts, exhibit.id).toMatchObject({ Title: partLabel(EXHIBITS, exhibit) });
		}
		expect(EXHIBITS.map((exhibit) => partLabel(EXHIBITS, exhibit))).toEqual(["U1", "Q1", "R1", "J1"]);
	});

	it("gives an Exhibit added to the Content a poster with its own Part label", () => {
		const content = [exhibit("first", "project"), exhibit("talk", "contact"), exhibit("second", "project")];
		const files = posters(content);
		expect(files.map(({ path }) => path)).toEqual(["posters/first.png", "posters/talk.png", "posters/second.png"]);
		expect(files.map(({ bytes }) => readPng(bytes).texts.Title)).toEqual(["U1", "J1", "U2"]);
		expect(readPng(files[2]?.bytes ?? Buffer.alloc(0)).texts).toMatchObject({ Software: "scripts/machine-art.ts" });
	});
});
