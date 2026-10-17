/**
 * The asset kinds that every art set builds in the same way: the Bug frames with their anchor,
 * and one poster per Exhibit. Each generator gives its own drawings and its own PNG writer.
 */
import { type Exhibit, type ExhibitKind, partLabel } from "../../src/game/content.ts";
import type { FileWriters, GeneratedFile } from "./files.ts";
import { type Pixmap, scaled } from "./pixmap.ts";

/** The point of a sprite frame that the Game core puts on the Bug position, in texels from the top left. */
export interface Anchor {
	left: number;
	top: number;
}

/**
 * One PNG per Bug frame in `sprites/`, in the order of `frames`, and `sprites/offsets.json`, which
 * gives every frame the same anchor (sprite PNGs have no place for it).
 */
export function bugFrameFiles(
	pngFile: FileWriters["pngFile"],
	frames: Readonly<Record<string, () => Pixmap>>,
	anchor: Anchor,
): GeneratedFile[] {
	const offsets = Object.fromEntries(Object.keys(frames).map((name) => [name, anchor]));
	return [
		...Object.entries(frames).map(([name, draw]) => pngFile(`sprites/${name}.png`, draw())),
		{ path: "sprites/offsets.json", bytes: Buffer.from(`${JSON.stringify(offsets, null, "\t")}\n`) },
	];
}

/**
 * One poster for each Exhibit of `content`, named by its id in the posters folder
 * (`posters/<id>.png`, where the art set looks for it). `draw` gets the kind and the Part label of
 * the Exhibit; the poster is that drawing at `scale` times its size, with the Part label in a
 * `Title` text chunk.
 */
export function posterFiles(
	pngFile: FileWriters["pngFile"],
	content: readonly Exhibit[],
	draw: (kind: ExhibitKind, label: string) => Pixmap,
	scale: number,
): GeneratedFile[] {
	return content.map((exhibit) => {
		const label = partLabel(content, exhibit);
		return pngFile(`posters/${exhibit.id}.png`, scaled(draw(exhibit.kind, label), scale), { Title: label });
	});
}
