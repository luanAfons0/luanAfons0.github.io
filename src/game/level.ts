import type { Grid } from "../engine/grid";

/** The Level model: what the Game core needs from a Tiled map. Positions are in tiles. */
export interface Level {
	walls: Grid;
	/** The texture name for each wall cell value (a Tiled gid). Unused values are empty. */
	wallTextures: ReadonlyArray<string | undefined>;
	playerStart: { x: number; y: number; angle: number };
}

const WALL_LAYER = "walls";
const PLAYER_START = "player_start";
/** The tile property that names the wall texture of a wall tile. */
const TEXTURE_PROPERTY = "texture";
/** Wall cells are stored as bytes. */
const MAX_WALL_GID = 255;
/** Tiled keeps flip and rotation flags in the top bits of a gid. */
const GID_MASK = 0x0fffffff;

/**
 * Turns parsed Tiled JSON into the Level model.
 * It fails with a clear error when the map does not have what the game needs.
 */
export function loadLevel(json: unknown): Level {
	const map = asRecord(json, "Level");
	const width = asNumber(map.width, "Level width");
	const height = asNumber(map.height, "Level height");
	const tileWidth = asNumber(map.tilewidth, "Level tilewidth");
	const tileHeight = asNumber(map.tileheight, "Level tileheight");
	const layers = asArray(map.layers, "Level layers").map((layer) => asRecord(layer, "Level layer"));

	const wallLayer = layers.find((layer) => layer.type === "tilelayer" && layer.name === WALL_LAYER);
	if (!wallLayer) throw new Error(`Level has no tile layer named "${WALL_LAYER}".`);
	const data = asArray(wallLayer.data, `"${WALL_LAYER}" layer data`);
	if (data.length !== width * height) {
		throw new Error(`"${WALL_LAYER}" layer has ${data.length} tiles, expected ${width * height}.`);
	}
	const cells = new Uint8Array(width * height);
	data.forEach((gid, i) => {
		const id = asNumber(gid, `"${WALL_LAYER}" tile ${i}`) & GID_MASK;
		if (id > MAX_WALL_GID)
			throw new Error(`"${WALL_LAYER}" tile ${i} has gid ${id}; wall gids must be ${MAX_WALL_GID} or less.`);
		cells[i] = id;
	});
	const tilesets = asArray(map.tilesets, "Level tilesets").map((tileset) => asRecord(tileset, "Level tileset"));
	const wallTextures: (string | undefined)[] = [];
	for (const gid of new Set(cells)) {
		if (gid !== 0) wallTextures[gid] = wallTexture(tilesets, gid);
	}

	const objects = layers
		.filter((layer) => layer.type === "objectgroup")
		.flatMap((layer) => asArray(layer.objects, "object layer objects"))
		.map((object) => asRecord(object, "Level object"));
	const starts = objects.filter((object) => objectType(object) === PLAYER_START);
	if (starts.length !== 1) {
		throw new Error(`Level must have exactly one "${PLAYER_START}" object, found ${starts.length}.`);
	}
	const start = starts[0] as Record<string, unknown>;
	const angleDegrees = asNumber(property(start, "angle") ?? 0, `"${PLAYER_START}" angle`);

	return {
		walls: { width, height, cells },
		wallTextures,
		playerStart: {
			x: asNumber(start.x, `"${PLAYER_START}" x`) / tileWidth,
			y: asNumber(start.y, `"${PLAYER_START}" y`) / tileHeight,
			angle: (angleDegrees * Math.PI) / 180,
		},
	};
}

/** Finds the "texture" property of a wall tile in the tileset that holds its gid. */
function wallTexture(tilesets: Record<string, unknown>[], gid: number): string {
	let tileset: Record<string, unknown> | undefined;
	let firstGid = 0;
	for (const candidate of tilesets) {
		const first = asNumber(candidate.firstgid, "Tileset firstgid");
		if (first <= gid && first > firstGid) {
			tileset = candidate;
			firstGid = first;
		}
	}
	if (!tileset) throw new Error(`Wall tile gid ${gid} is in no tileset.`);
	if (typeof tileset.source === "string") {
		throw new Error(`Tileset "${tileset.source}" is external. Embed it in the Level (Tiled: Embed Tileset).`);
	}
	const tile = (Array.isArray(tileset.tiles) ? tileset.tiles : []).find(
		(t: unknown) => typeof t === "object" && t !== null && (t as { id?: unknown }).id === gid - firstGid,
	);
	const texture = tile ? property(tile as Record<string, unknown>, TEXTURE_PROPERTY) : undefined;
	if (typeof texture !== "string" || texture === "") {
		throw new Error(`Wall tile gid ${gid} has no "${TEXTURE_PROPERTY}" property.`);
	}
	return texture;
}

/** Tiled 1.9 wrote "class"; 1.10 and later write "type". */
function objectType(object: Record<string, unknown>): unknown {
	return object.type ?? object.class;
}

function property(object: Record<string, unknown>, name: string): unknown {
	if (!Array.isArray(object.properties)) return undefined;
	const found = object.properties.find(
		(p: unknown) => typeof p === "object" && p !== null && (p as { name?: unknown }).name === name,
	);
	return (found as { value?: unknown } | undefined)?.value;
}

function asRecord(value: unknown, what: string): Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new Error(`${what} must be an object.`);
	}
	return value as Record<string, unknown>;
}

function asArray(value: unknown, what: string): unknown[] {
	if (!Array.isArray(value)) throw new Error(`${what} must be an array.`);
	return value;
}

function asNumber(value: unknown, what: string): number {
	if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${what} must be a number.`);
	return value;
}
