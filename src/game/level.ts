import { cellAt, type Grid } from "../engine/grid";
import { Face } from "../engine/raycast";

/** The Level model: what the Game core needs from a Tiled map. Positions are in tiles. */
export interface Level {
	walls: Grid;
	/** The texture name for each wall cell value (a Tiled gid). Unused values are empty. */
	wallTextures: ReadonlyArray<string | undefined>;
	playerStart: { x: number; y: number; angle: number };
	rooms: Room[];
	exhibits: ExhibitPlacement[];
}

/** Where an Exhibit hangs: one face of one wall cell. Tiled stores only the Exhibit `id`, not its content. */
export interface ExhibitPlacement {
	id: string;
	/** The wall cell, in tiles. */
	x: number;
	y: number;
	/** The side of the wall the poster is on. */
	face: Face;
}

/** One named area of the Level: a Tiled rectangle object. Positions are in tiles. */
export interface Room {
	name: string;
	x: number;
	y: number;
	width: number;
	height: number;
}

const WALL_LAYER = "walls";
const PLAYER_START = "player_start";
/** The tile property that names the wall texture of a wall tile. */
const TEXTURE_PROPERTY = "texture";
/** Wall cells are stored as bytes. */
const MAX_WALL_GID = 255;
const ROOM = "room";
const EXHIBIT = "exhibit";
const FACINGS: Record<string, Face> = { north: Face.North, east: Face.East, south: Face.South, west: Face.West };
/** The cell in front of each face, as an offset from the wall cell. */
export const FACE_OFFSETS: Record<Face, [number, number]> = {
	[Face.North]: [0, -1],
	[Face.East]: [1, 0],
	[Face.South]: [0, 1],
	[Face.West]: [-1, 0],
};
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
	const walls: Grid = { width, height, cells };

	return {
		walls,
		wallTextures,
		playerStart: {
			x: asNumber(start.x, `"${PLAYER_START}" x`) / tileWidth,
			y: asNumber(start.y, `"${PLAYER_START}" y`) / tileHeight,
			angle: (angleDegrees * Math.PI) / 180,
		},
		rooms: loadRooms(
			objects.filter((object) => objectType(object) === ROOM),
			tileWidth,
			tileHeight,
		),
		exhibits: loadExhibits(
			objects.filter((object) => objectType(object) === EXHIBIT),
			walls,
			tileWidth,
			tileHeight,
		),
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

/** Rooms are named rectangle objects (type "room"). The object name is the Room name. */
function loadRooms(objects: Record<string, unknown>[], tileWidth: number, tileHeight: number): Room[] {
	const rooms: Room[] = [];
	for (const object of objects) {
		const name = typeof object.name === "string" ? object.name.trim() : "";
		if (name === "") throw new Error(`Room object ${String(object.id)} has no name.`);
		if (rooms.some((room) => room.name === name)) throw new Error(`Two Rooms are named "${name}".`);
		const width = asNumber(object.width, `Room "${name}" width`);
		const height = asNumber(object.height, `Room "${name}" height`);
		if (object.point || object.ellipse || object.polygon || object.polyline || width <= 0 || height <= 0) {
			throw new Error(`Room "${name}" must be a rectangle with a width and a height.`);
		}
		if ((object.rotation ?? 0) !== 0) throw new Error(`Room "${name}" must not be rotated.`);
		rooms.push({
			name,
			x: asNumber(object.x, `Room "${name}" x`) / tileWidth,
			y: asNumber(object.y, `Room "${name}" y`) / tileHeight,
			width: width / tileWidth,
			height: height / tileHeight,
		});
	}
	return rooms;
}

/**
 * Exhibits are point objects (type "exhibit") inside a wall cell. The `id` property names the
 * Exhibit in the Content, and the `facing` property (north, east, south, or west) names the side
 * of the wall the poster is on. The cell on that side must be empty, so the player can see it.
 */
function loadExhibits(
	objects: Record<string, unknown>[],
	walls: Grid,
	tileWidth: number,
	tileHeight: number,
): ExhibitPlacement[] {
	const exhibits: ExhibitPlacement[] = [];
	for (const object of objects) {
		const id = property(object, "id");
		if (typeof id !== "string" || id.trim() === "") {
			throw new Error(`Exhibit object ${String(object.id)} has no "id" property.`);
		}
		const facing = property(object, "facing");
		const face = typeof facing === "string" ? FACINGS[facing] : undefined;
		if (face === undefined) {
			throw new Error(`Exhibit "${id}" needs a "facing" property: north, east, south, or west.`);
		}
		const x = Math.floor(asNumber(object.x, `Exhibit "${id}" x`) / tileWidth);
		const y = Math.floor(asNumber(object.y, `Exhibit "${id}" y`) / tileHeight);
		if (cellAt(walls, x, y) === 0 || x >= walls.width || y >= walls.height || x < 0 || y < 0) {
			throw new Error(`Exhibit "${id}" must be on a wall cell, but cell (${x}, ${y}) is not a wall in the Level.`);
		}
		const [dx, dy] = FACE_OFFSETS[face];
		if (cellAt(walls, x + dx, y + dy) !== 0) {
			throw new Error(`Exhibit "${id}" faces ${facing}, but the cell on that side of (${x}, ${y}) is not empty.`);
		}
		if (exhibits.some((other) => other.id === id)) throw new Error(`Exhibit "${id}" is placed twice in the Level.`);
		if (exhibits.some((other) => other.x === x && other.y === y && other.face === face)) {
			throw new Error(`Exhibit "${id}" hangs on the same wall face as another Exhibit.`);
		}
		exhibits.push({ id, x, y, face });
	}
	return exhibits;
}

/** Returns the first Room whose rectangle holds the point, or undefined. */
export function roomAt(rooms: readonly Room[], x: number, y: number): Room | undefined {
	return rooms.find((room) => x >= room.x && x < room.x + room.width && y >= room.y && y < room.y + room.height);
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
