// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { EXHIBITS, type Exhibit } from "../game/content";
import { loadLevel } from "../game/level";
import { tiledExhibit, tiledLevel, tiledRoom } from "../game/test-support/tiled-level";
import { skipViewPage } from "./page";
import { buildSkipView } from "./skip-view";

const BASE = "/portfolio/";

/** Sample Content for one Exhibit. */
function exhibit(id: string, overrides: Partial<Exhibit> = {}): Exhibit {
	return {
		id,
		kind: "project",
		title: `Title of ${id}`,
		summary: `Summary of ${id}`,
		details: [`Details of ${id}`],
		links: [{ label: `Source of ${id}`, url: `https://example.com/${id}` }],
		poster: `posters/${id}.png`,
		...overrides,
	};
}

/**
 * Two Rooms side by side, split by a wall at x 4 with a gap at y 2:
 * West is x 1..3, East is x 5..7.
 */
const ROWS = ["#########", "#P..#...#", "#.......#", "#...#...#", "#########"];
const WEST = tiledRoom("West Wing", { x: 1, y: 1, width: 3, height: 3 });
const EAST = tiledRoom("East Wing", { x: 5, y: 1, width: 3, height: 3 });

function parse(html: string): Document {
	return new DOMParser().parseFromString(html, "text/html");
}

/** The titles of the Exhibits under each Room heading, in page order. */
function exhibitsByRoom(doc: Document): Record<string, string[]> {
	const groups: Record<string, string[]> = {};
	for (const section of doc.querySelectorAll("main section")) {
		const room = section.querySelector("h2")?.textContent?.trim() ?? "";
		groups[room] = [...section.querySelectorAll("article h3")].map((h) => h.textContent?.trim() ?? "");
	}
	return groups;
}

describe("Skip View builder (Seam 2)", () => {
	it("puts every Exhibit under the Room the player stands in to see it", () => {
		// "east-poster" hangs on the dividing wall (x 4, inside no Room's floor) and faces east,
		// so the player sees it from the East Wing. "west-poster" faces west, into the West Wing.
		const level = loadLevel(
			tiledLevel({
				rows: ROWS,
				extraObjects: [
					WEST,
					EAST,
					tiledExhibit("east-poster", { x: 4, y: 1 }, "east"),
					tiledExhibit("west-poster", { x: 4, y: 3 }, "west"),
					tiledExhibit("north-wall", { x: 2, y: 0 }, "south"),
				],
			}),
		);
		const html = buildSkipView({
			content: [exhibit("west-poster"), exhibit("east-poster"), exhibit("north-wall")],
			level,
			base: BASE,
		});
		expect(exhibitsByRoom(parse(html))).toEqual({
			"West Wing": ["Title of west-poster", "Title of north-wall"],
			"East Wing": ["Title of east-poster"],
		});
	});

	it("shows each Exhibit with its kind, summary, details, and every link as a list of links", () => {
		const level = loadLevel(
			tiledLevel({ rows: ROWS, extraObjects: [WEST, tiledExhibit("orca", { x: 4, y: 1 }, "west")] }),
		);
		const orca = exhibit("orca", {
			kind: "job",
			details: ["First paragraph.", "Second paragraph."],
			links: [
				{ label: "Source code", url: "https://github.com/example/orca" },
				{ label: "Live demo", url: "https://orca.example.com/" },
				{ label: "Email", url: "mailto:me@example.com" },
			],
		});
		const article = parse(buildSkipView({ content: [orca], level, base: BASE })).querySelector("main section article");
		expect(article?.querySelector("h3")?.textContent).toBe("Title of orca");
		// A root path to the public poster: Vite adds the base, as it does for every asset URL in a page.
		expect(article?.querySelector("img")?.getAttribute("src")).toBe("/posters/orca.png");
		expect(article?.textContent).toContain("Job");
		expect([...(article?.querySelectorAll("p") ?? [])].map((p) => p.textContent)).toEqual(
			expect.arrayContaining(["Summary of orca", "First paragraph.", "Second paragraph."]),
		);
		const links = [...(article?.querySelectorAll("ul > li > a") ?? [])].map((a) => [
			a.textContent,
			a.getAttribute("href"),
		]);
		expect(links).toEqual([
			["Source code", "https://github.com/example/orca"],
			["Live demo", "https://orca.example.com/"],
			["Email", "mailto:me@example.com"],
		]);
	});

	it("is a whole static page with a link back to the Title Screen and no script", () => {
		const level = loadLevel(
			tiledLevel({ rows: ROWS, extraObjects: [WEST, tiledExhibit("orca", { x: 4, y: 1 }, "west")] }),
		);
		const html = buildSkipView({ content: [exhibit("orca")], level, base: BASE });
		const doc = parse(html);
		expect(html.startsWith("<!doctype html>")).toBe(true);
		expect(doc.documentElement.lang).toBe("en");
		expect(doc.title).not.toBe("");
		expect(doc.querySelectorAll("h1")).toHaveLength(1);
		const titleScreen = [...doc.querySelectorAll("a")].filter((a) => a.getAttribute("href") === BASE);
		expect(titleScreen).toHaveLength(1);
		expect(titleScreen[0]?.textContent).toMatch(/Title Screen/);
		expect(html).not.toMatch(/<script/i);
	});

	it("links the site icon, so the browser does not ask for a missing favicon.ico", () => {
		const level = loadLevel(
			tiledLevel({ rows: ROWS, extraObjects: [WEST, tiledExhibit("orca", { x: 4, y: 1 }, "west")] }),
		);
		const doc = parse(buildSkipView({ content: [exhibit("orca")], level, base: BASE }));
		// Vite adds the base path, as it does for the posters.
		expect(doc.querySelector('link[rel="icon"]')?.getAttribute("href")).toBe("/favicon.svg");
	});

	it("shows Content text as text, not as markup", () => {
		const level = loadLevel(
			tiledLevel({
				rows: ROWS,
				extraObjects: [
					tiledRoom("R&D <lab>", { x: 1, y: 1, width: 3, height: 3 }),
					tiledExhibit("orca", { x: 4, y: 1 }, "west"),
				],
			}),
		);
		const orca = exhibit("orca", {
			title: "<b>C & C++</b>",
			links: [{ label: 'Say "hi"', url: 'https://example.com/?a=1&b="2"' }],
		});
		const doc = parse(buildSkipView({ content: [orca], level, base: BASE }));
		expect(doc.querySelector("main h2")?.textContent).toBe("R&D <lab>");
		expect(doc.querySelector("main h3")?.textContent).toBe("<b>C & C++</b>");
		expect(doc.querySelector("main b")).toBeNull();
		const link = doc.querySelector("main article ul a");
		expect([link?.textContent, link?.getAttribute("href")]).toEqual(['Say "hi"', 'https://example.com/?a=1&b="2"']);
	});

	it("fails and names the Exhibit when a Content Exhibit is not placed in the Level", () => {
		const level = loadLevel(tiledLevel({ rows: ROWS, extraObjects: [WEST] }));
		expect(() => buildSkipView({ content: [exhibit("orca")], level, base: BASE })).toThrow(/"orca"/);
	});

	it("fails and names the Exhibit when the Level places an Exhibit that the Content does not have", () => {
		const level = loadLevel(
			tiledLevel({ rows: ROWS, extraObjects: [WEST, tiledExhibit("orca", { x: 4, y: 1 }, "west")] }),
		);
		expect(() => buildSkipView({ content: [], level, base: BASE })).toThrow(/"orca"/);
	});

	it("fails and names the Exhibit when one of its links is not an http, https, or mailto URL", () => {
		const level = loadLevel(
			tiledLevel({ rows: ROWS, extraObjects: [WEST, tiledExhibit("orca", { x: 4, y: 1 }, "west")] }),
		);
		const orca = exhibit("orca", { links: [{ label: "Bad", url: "javascript:alert(1)" }] });
		expect(() => buildSkipView({ content: [orca], level, base: BASE })).toThrow(/"orca"/);
	});

	it("fails and names the Exhibit when the player sees it from no Room", () => {
		// Only the East Wing is a Room, and the poster faces west, into the space that is no Room.
		const level = loadLevel(
			tiledLevel({ rows: ROWS, extraObjects: [EAST, tiledExhibit("orca", { x: 4, y: 1 }, "west")] }),
		);
		expect(() => buildSkipView({ content: [exhibit("orca")], level, base: BASE })).toThrow(/"orca"/);
	});

	it("builds the real Level and the real Content with every Exhibit and every link", () => {
		const doc = parse(skipViewPage(BASE));
		const shown = [...doc.querySelectorAll("main section article h3")].map((h) => h.textContent);
		expect(shown.sort()).toEqual(EXHIBITS.map((e) => e.title).sort());
		const hrefs = [...doc.querySelectorAll("main a")].map((a) => a.getAttribute("href"));
		for (const { url } of EXHIBITS.flatMap((e) => e.links)) expect(hrefs).toContain(url);
	});
});
