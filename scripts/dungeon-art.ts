/**
 * Draws and synthesizes the dungeon art set procedurally and writes it under `public/dungeon/`. It
 * uses only Node built-ins and fixed seeds, so every run gives byte-identical files. The files are
 * committed, so the build needs no generation step. Each file names this script as its provenance.
 *
 * Usage (Node 24 or later runs TypeScript directly):
 *   node scripts/dungeon-art.ts [output folder]
 *
 * Each asset kind is one module under `scripts/dungeon-art/` that returns its files. To add a
 * kind, write its module and add it to `KINDS`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { bugs } from "./dungeon-art/bugs.ts";
import type { GeneratedFile } from "./dungeon-art/files.ts";
import { plate } from "./dungeon-art/plate.ts";
import { posters } from "./dungeon-art/posters.ts";
import { sounds } from "./dungeon-art/sounds.ts";
import { textures } from "./dungeon-art/textures.ts";
import { tiles } from "./dungeon-art/tiles.ts";

/** The dungeon art folder, from the repository root. The art set in `src/game/theme.ts` points here. */
export const DUNGEON_ART_FOLDER = "public/dungeon";

/** The asset kinds, in the order they are written. */
const KINDS: readonly (() => GeneratedFile[])[] = [textures, bugs, () => posters(), sounds, tiles, plate];

/** Writes every file of the dungeon art set into `outDir`. Returns their paths inside `outDir`, sorted. */
export function generateDungeonArt(outDir: string): string[] {
	const files = KINDS.flatMap((kind) => kind());
	for (const { path, bytes } of files) {
		mkdirSync(dirname(join(outDir, path)), { recursive: true });
		writeFileSync(join(outDir, path), bytes);
	}
	return files.map(({ path }) => path).sort();
}

if (import.meta.main) {
	const outDir = process.argv[2] ?? join(import.meta.dirname, "..", DUNGEON_ART_FOLDER);
	const files = generateDungeonArt(outDir);
	console.log(`Wrote ${files.length} dungeon art files into ${outDir}.`);
}
