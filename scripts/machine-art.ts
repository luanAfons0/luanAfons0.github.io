/**
 * Draws and synthesizes the machine art set procedurally and writes it under `public/machine/`. It uses only
 * Node built-ins and fixed seeds, so every run gives the same images, sounds, and texts (another zlib
 * can compress a PNG to other bytes, so the tests compare PNGs by image data and text). The files
 * are committed, so the build needs no generation step. Each PNG and WAV names this script as its
 * provenance.
 *
 * Usage (Node 24 or later runs TypeScript directly):
 *   node scripts/machine-art.ts [output folder]
 *
 * Each asset kind is one module under `scripts/machine-art/` that returns its files. To add a
 * kind, write its module and add it to `KINDS`.
 */
import { join } from "node:path";
import { type GeneratedFile, writeFiles } from "./art-kit/files.ts";
import { bugs } from "./machine-art/bugs.ts";
import { flats } from "./machine-art/flats.ts";
import { posters } from "./machine-art/posters.ts";
import { sounds } from "./machine-art/sounds.ts";
import { textures } from "./machine-art/textures.ts";

/** The machine art folder, from the repository root. The art set in `src/game/theme.ts` points here. */
export const MACHINE_ART_FOLDER = "public/machine";

/** The asset kinds, in the order they are written. */
const KINDS: readonly (() => GeneratedFile[])[] = [textures, flats, bugs, () => posters(), sounds];

/** Writes every file of the machine art set into `outDir`. Returns their paths inside `outDir`, sorted. */
export function generateMachineArt(outDir: string): string[] {
	const files = KINDS.flatMap((kind) => kind());
	return writeFiles(outDir, files);
}

if (import.meta.main) {
	const outDir = process.argv[2] ?? join(import.meta.dirname, "..", MACHINE_ART_FOLDER);
	const files = generateMachineArt(outDir);
	console.log(`Wrote ${files.length} machine art files into ${outDir}.`);
}
