/**
 * Builds small Tiled JSON Levels for tests, from ASCII rows.
 * `#` is a wall tile (gid 1), `.` is empty, `P` is empty and holds the player start.
 * Tiled stores object positions in pixels, so this helper does too.
 */
export const TILE_SIZE = 64;

export interface TiledLevelOptions {
	rows: string[];
	/** Player start angle in degrees (0 faces +x, 90 faces +y). */
	playerAngle?: number;
	/** Player start offset inside the `P` cell, in tiles. Default is the cell center. */
	playerOffset?: { x: number; y: number };
	extraObjects?: object[];
}

export function tiledLevel(options: TiledLevelOptions): unknown {
	const { rows, playerAngle = 0, playerOffset = { x: 0.5, y: 0.5 } } = options;
	const height = rows.length;
	const width = rows[0]?.length ?? 0;
	const data: number[] = [];
	const objects: object[] = [...(options.extraObjects ?? [])];
	rows.forEach((row, y) => {
		[...row].forEach((char, x) => {
			data.push(char === "#" ? 1 : 0);
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
		tilesets: [{ firstgid: 1, source: "walls.tsx" }],
	};
}
