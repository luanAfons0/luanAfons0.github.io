import { fileWriters } from "../art-kit/files.ts";

export { type GeneratedFile, SAMPLE_RATE } from "../art-kit/files.ts";

/** The provenance each generated file carries in its metadata. */
export const GENERATOR = "scripts/dungeon-art.ts";

export const { pngFile, wavFile } = fileWriters(GENERATOR);
