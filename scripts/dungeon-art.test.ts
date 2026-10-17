import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { EXHIBITS, type Exhibit, partLabel } from "../src/game/content.ts";
import { DUNGEON_ART_SET, TEXTURE_ROLES } from "../src/game/theme.ts";
import { readPng, sameContent } from "./art-kit/read-files.ts";
import { posters } from "./dungeon-art/posters.ts";
import { DUNGEON_ART_FOLDER, generateDungeonArt } from "./dungeon-art.ts";

const GENERATOR = "scripts/dungeon-art.ts";
const runs: string[] = [];

/** Runs the generator into a new temp folder and returns the folder and the files it wrote. */
function generate(): { folder: string; files: string[] } {
	const folder = mkdtempSync(join(tmpdir(), "dungeon-art-"));
	runs.push(folder);
	return { folder, files: generateDungeonArt(folder) };
}

afterAll(() => {
	for (const folder of runs) rmSync(folder, { recursive: true, force: true });
});

/** A folder of the art set (under `public/`) as a path inside the dungeon art folder. */
function inDungeonFolder(folder: string): string {
	const inside = relative(DUNGEON_ART_FOLDER, join("public", folder));
	expect(inside.startsWith(".."), `${folder} is not in ${DUNGEON_ART_FOLDER}`).toBe(false);
	return inside;
}

/** The size of a PNG, from its header. */
function pngSize(png: Buffer): [width: number, height: number] {
	return [png.readUInt32BE(16), png.readUInt32BE(20)];
}

describe("dungeon art generator", () => {
	it("writes a 64x64 wall texture for every texture role of the dungeon art set", () => {
		const { folder, files } = generate();
		const textures = inDungeonFolder(DUNGEON_ART_SET.folders.textures);
		for (const role of TEXTURE_ROLES) {
			const file = `${textures}/${DUNGEON_ART_SET.textures[role]}.png`;
			expect(files, role).toContain(file);
			expect(pngSize(readFileSync(join(folder, file))), file).toEqual([64, 64]);
		}
	});

	it("writes every Slime frame of the art set into its sprites folder, each with an anchor", () => {
		const { folder, files } = generate();
		const sprites = inDungeonFolder(DUNGEON_ART_SET.folders.sprites);
		const offsets = JSON.parse(readFileSync(join(folder, sprites, "offsets.json"), "utf8"));
		const frames = [...DUNGEON_ART_SET.bugWalkFrames, ...DUNGEON_ART_SET.bugFixFrames];

		expect(DUNGEON_ART_SET.bugWalkFrames).toHaveLength(2);
		expect(DUNGEON_ART_SET.bugFixFrames).toHaveLength(6);
		for (const name of frames) {
			expect(files).toContain(`${sprites}/${name}.png`);
			expect(offsets[name]).toEqual({ left: expect.any(Number), top: expect.any(Number) });
		}
	});

	it("holds the cleared mark for the second half of the fix sequence", () => {
		const fix = DUNGEON_ART_SET.bugFixFrames;
		const held = fix.slice(fix.length / 2);
		expect(new Set(held)).toEqual(new Set(["slime-cleared"]));
		expect(fix.slice(0, fix.length / 2)).not.toContain("slime-cleared");
	});

	it("writes every sound of the art set as a mono 16-bit WAV that names the generator", () => {
		const { folder, files } = generate();
		const soundsFolder = inDungeonFolder(DUNGEON_ART_SET.folders.sounds);

		for (const name of Object.values(DUNGEON_ART_SET.sounds)) {
			const file = `${soundsFolder}/${name}.wav`;
			expect(files).toContain(file);
			const wav = readFileSync(join(folder, file));
			expect(wav.toString("latin1", 0, 4) + wav.toString("latin1", 8, 12), file).toBe("RIFFWAVE");
			expect(wav.readUInt32LE(4), file).toBe(wav.length - 8);
			expect([wav.readUInt16LE(20), wav.readUInt16LE(22), wav.readUInt16LE(34)], file).toEqual([1, 1, 16]);
			expect(wav.toString("latin1"), file).toContain("ISFT");
			expect(wav.toString("latin1"), file).toContain(GENERATOR);
		}
	});

	it("gives byte-identical files when it runs twice", () => {
		const first = generate();
		const second = generate();
		expect(second.files).toEqual(first.files);
		for (const file of first.files) {
			expect(readFileSync(join(second.folder, file)).equals(readFileSync(join(first.folder, file))), file).toBe(true);
		}
	});

	it("matches the committed files, so the build needs no generation step", () => {
		const { folder, files } = generate();
		for (const file of files) {
			const committed = readFileSync(join(import.meta.dirname, "..", DUNGEON_ART_FOLDER, file));
			const generated = readFileSync(join(folder, file));
			expect(sameContent(file, committed, generated), `${file} is out of date: run the generator`).toBe(true);
		}
	});

	it("names the generator as the provenance of each PNG", () => {
		const { folder, files } = generate();
		for (const file of files.filter((file) => file.endsWith(".png"))) {
			expect(readPng(readFileSync(join(folder, file))).texts, file).toMatchObject({ Software: GENERATOR });
		}
	});
});

describe("dungeon banner posters", () => {
	/** A sample Exhibit of a kind. */
	const exhibit = (id: string, kind: Exhibit["kind"]): Exhibit => ({
		id,
		kind,
		title: `Title of ${id}`,
		summary: "",
		details: [],
		links: [],
	});

	it("draws one banner per Exhibit of the Content, named by its id in the posters folder", () => {
		const { files } = generate();
		const postersFolder = inDungeonFolder(DUNGEON_ART_SET.folders.posters);
		for (const { id } of EXHIBITS) expect(files, id).toContain(`${postersFolder}/${id}.png`);
	});

	it("names each banner by the Part label the Skip View and the Exhibit Panel show", () => {
		const { folder } = generate();
		for (const exhibit of EXHIBITS) {
			const png = readFileSync(join(folder, `posters/${exhibit.id}.png`));
			expect(readPng(png).texts, exhibit.id).toMatchObject({ Title: partLabel(EXHIBITS, exhibit) });
		}
	});

	it("gives an Exhibit added to the Content a banner with its own Part label", () => {
		const content = [exhibit("first", "project"), exhibit("talk", "contact"), exhibit("second", "project")];
		const files = posters(content);
		expect(files.map(({ path }) => path)).toEqual(["posters/first.png", "posters/talk.png", "posters/second.png"]);
		expect(files.map(({ bytes }) => readPng(bytes).texts.Title)).toEqual(["U1", "J1", "U2"]);
	});

	it("draws a different pictogram for each kind of Exhibit", () => {
		const kinds = ["project", "contact", "skill", "job"] as const;
		const images = posters(kinds.map((kind) => exhibit(kind, kind))).map(({ bytes }) => readPng(bytes).data);
		const [project] = posters([exhibit("other", "project")]).map(({ bytes }) => readPng(bytes).data);
		expect(new Set(images.map((data) => data.toString("base64"))).size).toBe(kinds.length);
		// The same kind and Part label give the same banner.
		expect(project?.equals(images[0] ?? Buffer.alloc(0))).toBe(true);
	});
});

describe("dungeon page tiles", () => {
	/** The pulp page and the cover green of the approved mock, as RGB. */
	const PAGE = [0xe0, 0xd9, 0xc5];
	const COVER = [0x1d, 0x4a, 0x33];

	/** The RGBA pixels of a generated PNG (8-bit RGBA, filter 0 on each row). */
	function pixelsOf(png: Buffer): number[][] {
		const [width, height] = pngSize(png);
		const { data } = readPng(png);
		const pixels: number[][] = [];
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const at = y * (width * 4 + 1) + 1 + x * 4;
				pixels.push([...data.subarray(at, at + 4)]);
			}
		}
		return pixels;
	}

	/** True when each channel of `rgb` is at or under the channel of `ground`, and one is under it. */
	const darker = (rgb: number[], ground: number[]) =>
		rgb.every((value, i) => value <= (ground[i] as number)) && rgb.some((value, i) => value < (ground[i] as number));

	it("writes the pulp speck tile: opaque pulp page with a few darker specks", () => {
		const { folder, files } = generate();
		expect(files).toContain("tiles/pulp.png");
		const pixels = pixelsOf(readFileSync(join(folder, "tiles/pulp.png")));
		const plain = pixels.filter(([r, g, b]) => [r, g, b].join() === PAGE.join());

		expect(pixels.every(([, , , alpha]) => alpha === 255)).toBe(true);
		expect(plain.length / pixels.length).toBeGreaterThan(0.75);
		expect(plain.length).toBeLessThan(pixels.length);
		for (const pixel of pixels) if (!plain.includes(pixel)) expect(darker(pixel.slice(0, 3), PAGE)).toBe(true);
	});

	it("writes the cloth weave tile: opaque cover green crossed by darker threads", () => {
		const { folder, files } = generate();
		expect(files).toContain("tiles/weave.png");
		const pixels = pixelsOf(readFileSync(join(folder, "tiles/weave.png")));
		const plain = pixels.filter(([r, g, b]) => [r, g, b].join() === COVER.join());

		expect(pixels.every(([, , , alpha]) => alpha === 255)).toBe(true);
		expect(plain.length).toBeGreaterThan(0);
		for (const pixel of pixels) if (!plain.includes(pixel)) expect(darker(pixel.slice(0, 3), COVER)).toBe(true);
	});
});
