/**
 * Builds small Tiled JSON Levels for tests, from ASCII rows.
 * `#` is a wall tile (gid 1), `.` is empty, `P` is empty and holds the player start.
 * Other wall characters can be added with `wallTextures`.
 * Tiled stores object positions in pixels, so this helper does too.
 */
export const TILE_SIZE = 64;
/** The texture name of the `#` wall tile. */
export const TEST_WALL_TEXTURE = "TEST_WALL";

export interface TiledLevelOptions {
	rows: string[];
	/** Player start angle in degrees (0 faces +x, 90 faces +y). */
	playerAngle?: number;
	/** Player start offset inside the `P` cell, in tiles. Default is the cell center. */
	playerOffset?: { x: number; y: number };
	extraObjects?: object[];
	/**
	 * The texture name of each wall character. Each character becomes one wall tile, with gids
	 * in key order starting at 1. Default: `#` has `TEST_WALL_TEXTURE`.
	 */
	wallTextures?: Record<string, string>;
}

export function tiledLevel(options: TiledLevelOptions): unknown {
	const { rows, playerAngle = 0, playerOffset = { x: 0.5, y: 0.5 } } = options;
	const wallTextures = options.wallTextures ?? { "#": TEST_WALL_TEXTURE };
	const wallChars = Object.keys(wallTextures);
	const height = rows.length;
	const width = rows[0]?.length ?? 0;
	const data: number[] = [];
	const objects: object[] = [...(options.extraObjects ?? [])];
	rows.forEach((row, y) => {
		[...row].forEach((char, x) => {
			data.push(wallChars.indexOf(char) + 1);
			if (char === "P") {
				objects.push({
					id: objects.length + 1,
					name: "",
					type: "player_start",
					x: (x + playerOffset.x) * TILE_SIZE,
					y: (y + playerOffset.y) * TILE_SIZE,
					width: 0,
					height: 0,
					rotation: 0,
					point: true,
					visible: true,
					properties: [{ name: "angle", type: "float", value: playerAngle }],
				});
			}
		});
	});
	return {
		type: "map",
		orientation: "orthogonal",
		renderorder: "right-down",
		infinite: false,
		width,
		height,
		tilewidth: TILE_SIZE,
		tileheight: TILE_SIZE,
		layers: [
			{
				id: 1,
				name: "walls",
				type: "tilelayer",
				width,
				height,
				x: 0,
				y: 0,
				opacity: 1,
				visible: true,
				data,
			},
			{
				id: 2,
				name: "objects",
				type: "objectgroup",
				draworder: "topdown",
				x: 0,
				y: 0,
				opacity: 1,
				visible: true,
				objects,
			},
		],
		tilesets: [
			{
				firstgid: 1,
				name: "walls",
				tilewidth: TILE_SIZE,
				tileheight: TILE_SIZE,
				tilecount: wallChars.length,
				columns: 0,
				tiles: Object.values(wallTextures).map((texture, id) => ({
					id,
					properties: [{ name: "texture", type: "string", value: texture }],
				})),
			},
		],
	};
}

let nextRoomId = 1000;

/** A Tiled rectangle object for a Room. Position and size are in tiles. */
export function tiledRoom(name: string, rect: { x: number; y: number; width: number; height: number }): object {
	return {
		id: nextRoomId++,
		name,
		type: "room",
		x: rect.x * TILE_SIZE,
		y: rect.y * TILE_SIZE,
		width: rect.width * TILE_SIZE,
		height: rect.height * TILE_SIZE,
		rotation: 0,
		visible: true,
	};
}

let nextExhibitId = 2000;

/**
 * A Tiled point object for an Exhibit placement. `x` and `y` are the wall cell, in tiles.
 * `facing` is the side of the wall the poster is on.
 */
export function tiledExhibit(id: string, cell: { x: number; y: number }, facing: string): object {
	return {
		id: nextExhibitId++,
		name: "",
		type: "exhibit",
		x: (cell.x + 0.5) * TILE_SIZE,
		y: (cell.y + 0.5) * TILE_SIZE,
		width: 0,
		height: 0,
		rotation: 0,
		point: true,
		visible: true,
		properties: [
			{ name: "id", type: "string", value: id },
			{ name: "facing", type: "string", value: facing },
		],
	};
}
