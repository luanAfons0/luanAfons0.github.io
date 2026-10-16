import { describe, expect, it, vi } from "vitest";
import { createFramebuffer, rgb } from "../engine/framebuffer";
import type { InputSnapshot } from "../engine/input";
import { createTexture, type Texture } from "../engine/texture";
import { EXHIBITS, type Exhibit } from "./content";
import { createGame, type Game, HUD_HINT_COLOR, SCREEN_HEIGHT, SCREEN_WIDTH, STATUS_BAR_HEIGHT } from "./game";
import sampleLevel from "./levels/sample.json";
import { TEST_WALL_TEXTURE, tiledExhibit, tiledLevel } from "./test-support/tiled-level";

const IDLE: InputSnapshot = { forward: 0, strafe: 0, turn: 0, look: 0 };
const USE: InputSnapshot = { ...IDLE, use: true };

/** Sample Content for one Exhibit. */
function exhibit(id: string): Exhibit {
	return {
		id,
		kind: "project",
		title: `Title of ${id}`,
		summary: `Summary of ${id}`,
		details: [`Details of ${id}`],
		links: [{ label: "Source", url: `https://example.com/${id}` }],
		poster: `posters/${id}.png`,
	};
}

describe("Exhibit Content check", () => {
	// The player stands at x 1.5 and looks east along a corridor; the end wall is the cell x 6.
	const rows = ["#######", "#P....#", "#######"];

	it("fails creation and names the id when a Level Exhibit has no Content", () => {
		const level = tiledLevel({ rows, extraObjects: [tiledExhibit("orca", { x: 6, y: 1 }, "west")] });
		expect(() => createGame({ level, content: [] })).toThrow(/"orca"/);
	});

	it("fails creation and names the id when a Content Exhibit is not placed in the Level", () => {
		const level = tiledLevel({ rows, extraObjects: [tiledExhibit("orca", { x: 6, y: 1 }, "west")] });
		expect(() => createGame({ level, content: [exhibit("orca"), exhibit("resume")] })).toThrow(/"resume"/);
	});

	it.each([
		["a script", "javascript:alert(1)"],
		["a data URL", "data:text/html,<script>alert(1)</script>"],
		["a relative path", "/admin"],
		["no URL at all", "not a url"],
	])("fails creation and names the id when an Exhibit link is %s", (_, url) => {
		const level = tiledLevel({ rows, extraObjects: [tiledExhibit("orca", { x: 6, y: 1 }, "west")] });
		const orca = { ...exhibit("orca"), links: [{ label: "Bad", url }] };
		expect(() => createGame({ level, content: [orca] })).toThrow(/"orca".*link/);
	});

	it("accepts http, https, and mailto links", () => {
		const level = tiledLevel({ rows, extraObjects: [tiledExhibit("orca", { x: 6, y: 1 }, "west")] });
		const links = ["http://example.com/", "https://example.com/a?b=1", "mailto:me@example.com"].map((url) => ({
			label: url,
			url,
		}));
		expect(() => createGame({ level, content: [{ ...exhibit("orca"), links }] })).not.toThrow();
	});

	it("creates the Game core when every Level Exhibit has Content and every Content Exhibit is placed", () => {
		const level = tiledLevel({
			rows: ["#######", "#P....#", "#######"],
			extraObjects: [tiledExhibit("orca", { x: 6, y: 1 }, "west"), tiledExhibit("resume", { x: 3, y: 0 }, "south")],
		});
		expect(() => createGame({ level, content: [exhibit("resume"), exhibit("orca")] })).not.toThrow();
	});
});

describe("The real Level and the real Content (the build content check)", () => {
	it("create the Game core with no error", () => {
		expect(EXHIBITS.length).toBeGreaterThan(0);
		expect(() => createGame({ level: sampleLevel, content: EXHIBITS })).not.toThrow();
	});

	it("give every Exhibit a poster that is a committed PNG", () => {
		const committed = Object.keys(import.meta.glob("/public/posters/*.png"));
		for (const { id, poster } of EXHIBITS) expect(committed, id).toContain(`/public/${poster}`);
	});
});

describe("Exhibit placements in the Level", () => {
	const rows = ["#######", "#P....#", "#######"];
	const withoutProperty = (name: string) => {
		const object = tiledExhibit("orca", { x: 6, y: 1 }, "west") as { properties: { name: string }[] };
		return { ...object, properties: object.properties.filter((p) => p.name !== name) };
	};

	it.each([
		["has no id property", withoutProperty("id"), /Exhibit object \d+ has no "id" property/],
		["has no facing property", withoutProperty("facing"), /Exhibit "orca" needs a "facing" property/],
		["has an unknown facing", tiledExhibit("orca", { x: 6, y: 1 }, "up"), /Exhibit "orca" needs a "facing" property/],
		["is not on a wall cell", tiledExhibit("orca", { x: 3, y: 1 }, "west"), /Exhibit "orca" must be on a wall cell/],
		["faces another wall", tiledExhibit("orca", { x: 6, y: 1 }, "east"), /Exhibit "orca" faces east/],
	])("fails with a clear error when an Exhibit object %s", (_, object, error) => {
		const level = tiledLevel({ rows, extraObjects: [object] });
		expect(() => createGame({ level, content: [exhibit("orca")] })).toThrow(error);
	});

	it("fails with a clear error when the Level places the same Exhibit twice", () => {
		const level = tiledLevel({
			rows,
			extraObjects: [tiledExhibit("orca", { x: 6, y: 1 }, "west"), tiledExhibit("orca", { x: 3, y: 0 }, "south")],
		});
		expect(() => createGame({ level, content: [exhibit("orca")] })).toThrow(/Exhibit "orca" is placed twice/);
	});
});

describe("Exhibits in focus and use", () => {
	/**
	 * A corridor along y = 1.5. The "orca" poster is on the west face of the end wall (x = 6), and
	 * the player looks east at it from `distance` tiles away (the face is the line x = 6).
	 */
	function facingPoster(distance: number, playerAngle = 0): Game {
		return createGame({
			level: tiledLevel({
				rows: ["#######", "#P....#", "#######"],
				playerOffset: { x: 5 - distance, y: 0.5 },
				playerAngle,
				extraObjects: [tiledExhibit("orca", { x: 6, y: 1 }, "west")],
			}),
			content: [exhibit("orca")],
		});
	}

	it("has the Exhibit in focus when the player looks at its poster from close by", () => {
		const game = facingPoster(1);
		expect(game.state().exhibitInFocus).toBe("orca");
	});

	it("has no Exhibit in focus when the poster is out of range", () => {
		expect(facingPoster(2.5).state().exhibitInFocus).toBeNull();
	});

	it("has no Exhibit in focus when the player looks away from the poster", () => {
		expect(facingPoster(1, 180).state().exhibitInFocus).toBeNull();
	});

	it("has no Exhibit in focus when the player looks at another face of the same wall cell", () => {
		// The poster is on the south face of the cell (4, 1); the player looks at its west face from 1 tile away.
		const game = createGame({
			level: tiledLevel({
				rows: ["######", "#.P.##", "#....#", "######"],
				playerOffset: { x: 1, y: 0.5 },
				extraObjects: [tiledExhibit("orca", { x: 4, y: 1 }, "south")],
			}),
			content: [exhibit("orca")],
		});
		expect(game.state().exhibitInFocus).toBeNull();
	});

	it('shows "Press E" in the HUD, above the status bar, only while an Exhibit is in focus', () => {
		const hintPixels = (game: Game) => {
			const framebuffer = createFramebuffer(SCREEN_WIDTH, SCREEN_HEIGHT);
			game.render(framebuffer);
			const rows = new Set<number>();
			framebuffer.pixels.forEach((pixel, i) => {
				if (pixel === HUD_HINT_COLOR) rows.add(Math.floor(i / SCREEN_WIDTH));
			});
			return [...rows];
		};

		const inFocus = hintPixels(facingPoster(1));
		expect(inFocus.length).toBeGreaterThan(0);
		expect(Math.max(...inFocus)).toBeLessThan(SCREEN_HEIGHT - STATUS_BAR_HEIGHT);
		expect(hintPixels(facingPoster(2.5))).toEqual([]);
	});

	it("opens the Exhibit in focus on use and pauses the Game core", () => {
		const game = facingPoster(1);
		expect(game.openExhibitId()).toBeNull();
		game.step(USE);
		expect(game.state().openExhibit).toBe("orca");
		expect(game.openExhibitId()).toBe("orca");
		expect(game.state().paused).toBe(true);
	});

	it("opens nothing on use when no Exhibit is in range", () => {
		const game = facingPoster(2.5);
		game.step(USE);
		expect(game.state().openExhibit).toBeNull();
		expect(game.state().paused).toBe(false);
	});

	it("closes the open Exhibit and resumes the Game core", () => {
		const game = facingPoster(1);
		game.step(USE);
		game.closeExhibit();
		expect(game.state().openExhibit).toBeNull();
		expect(game.openExhibitId()).toBeNull();
		expect(game.state().paused).toBe(false);
		game.step({ ...IDLE, forward: -1 });
		expect(game.state().player.x).toBeLessThan(5);
	});
});

describe("Exhibit posters", () => {
	const RED = rgb(255, 0, 0);
	const GREEN = rgb(0, 255, 0);
	const solidTexture = (color: number, width = 4, height = 4): Texture => {
		const rgba = new Uint8Array(width * height * 4);
		new Uint32Array(rgba.buffer).fill(color);
		return createTexture(width, height, rgba);
	};
	const channels = (pixel: number) => [pixel & 0xff, (pixel >>> 8) & 0xff, (pixel >>> 16) & 0xff];
	const level = tiledLevel({
		rows: ["#######", "#P....#", "#######"],
		playerOffset: { x: 3, y: 0.5 },
		extraObjects: [tiledExhibit("orca", { x: 6, y: 1 }, "west")],
	});

	it("draws the poster in the middle of its wall face, with the wall around it", () => {
		// The player looks east at the poster face from 2 tiles away: the face is about 178 px wide.
		const game = createGame({
			level,
			content: [exhibit("orca")],
			textures: { [TEST_WALL_TEXTURE]: solidTexture(RED, 64, 64) },
			posters: { orca: solidTexture(GREEN, 8, 10) },
		});
		const framebuffer = createFramebuffer(SCREEN_WIDTH, SCREEN_HEIGHT);
		game.render(framebuffer);
		const horizon = (SCREEN_HEIGHT - STATUS_BAR_HEIGHT) / 2;
		const at = (x: number, y: number) => channels(framebuffer.pixels[y * SCREEN_WIDTH + x] as number);

		const [posterRed, posterGreen, posterBlue] = at(SCREEN_WIDTH / 2, horizon);
		expect(posterGreen).toBeGreaterThan(0);
		expect(posterRed + posterBlue).toBe(0);
		// Near the left and right edges of the face, and near its top, the wall shows.
		for (const [x, y] of [
			[SCREEN_WIDTH / 2 - 80, horizon],
			[SCREEN_WIDTH / 2 + 80, horizon],
			[SCREEN_WIDTH / 2, horizon - 80],
		] as const) {
			const [red, green, blue] = at(x, y);
			expect(red, `(${x}, ${y})`).toBeGreaterThan(0);
			expect(green + blue, `(${x}, ${y})`).toBe(0);
		}
	});

	it.each([
		// [facing, player cell, player angle]: the player stands 1.5 tiles in front of the face and looks at it.
		["north", { x: 3, y: 1 }, 90],
		["east", { x: 5, y: 3 }, 180],
		["south", { x: 3, y: 5 }, 270],
		["west", { x: 1, y: 3 }, 0],
	] as const)("shows the poster on a %s face the right way round (not mirrored)", (facing, cell, playerAngle) => {
		const rows = ["#######", "#.....#", "#.....#", "#..#..#", "#.....#", "#.....#", "#######"].map((row, y) =>
			y === cell.y ? `${row.slice(0, cell.x)}P${row.slice(cell.x + 1)}` : row,
		);
		const BLUE = rgb(0, 0, 255);
		const rgba = new Uint8Array(8);
		new Uint32Array(rgba.buffer).set([GREEN, BLUE]); // Left half green, right half blue.
		const game = createGame({
			level: tiledLevel({ rows, playerAngle, extraObjects: [tiledExhibit("orca", { x: 3, y: 3 }, facing)] }),
			content: [exhibit("orca")],
			textures: { [TEST_WALL_TEXTURE]: solidTexture(RED, 64, 64) },
			posters: { orca: createTexture(2, 1, rgba) },
		});
		const framebuffer = createFramebuffer(SCREEN_WIDTH, SCREEN_HEIGHT);
		game.render(framebuffer);
		const horizon = (SCREEN_HEIGHT - STATUS_BAR_HEIGHT) / 2;
		const at = (x: number) => channels(framebuffer.pixels[horizon * SCREEN_WIDTH + x] as number);

		expect(at(SCREEN_WIDTH / 2 - 30)).toEqual([0, expect.any(Number), 0]);
		expect(at(SCREEN_WIDTH / 2 - 30)[1]).toBeGreaterThan(0);
		expect(at(SCREEN_WIDTH / 2 + 30)).toEqual([0, 0, expect.any(Number)]);
		expect(at(SCREEN_WIDTH / 2 + 30)[2]).toBeGreaterThan(0);
	});

	it("fails with a clear error that names the id when a poster image is missing", () => {
		expect(() =>
			createGame({
				level,
				content: [exhibit("orca")],
				textures: { [TEST_WALL_TEXTURE]: solidTexture(RED) },
				posters: {},
			}),
		).toThrow(/Exhibit "orca" has no poster image/);
	});
});

describe("Exhibit analytics", () => {
	it("sends exhibit/<id> each time the player opens an Exhibit", () => {
		const track = vi.fn();
		const game = createGame({
			level: tiledLevel({
				rows: ["#######", "#P....#", "#######"],
				playerOffset: { x: 4, y: 0.5 },
				extraObjects: [tiledExhibit("orca", { x: 6, y: 1 }, "west")],
			}),
			content: [exhibit("orca")],
			track,
		});

		game.step(IDLE);
		expect(track).not.toHaveBeenCalled();
		game.step(USE);
		expect(track).toHaveBeenCalledExactlyOnceWith("exhibit/orca");
	});
});
