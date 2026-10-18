// @vitest-environment happy-dom
// The real page links its stylesheet, and the tests have no server: happy-dom must not fetch it.
// @vitest-environment-options { "settings": { "disableCSSFileLoading": true, "handleDisabledFileLoadingAsSuccess": true } }
import { describe, expect, it } from "vitest";
import { EXHIBITS, type Exhibit } from "../game/content";
import { loadLevel } from "../game/level";
import { tiledExhibit, tiledLevel, tiledRoom } from "../game/test-support/tiled-level";
import { THEMES } from "../game/theme";
import { withThemeScript } from "../theme-script";
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
		// The kind sits in the gutter with the Part label, not above the heading.
		expect(article?.querySelector(".skip-gutter .skip-kind")?.textContent).toBe("Job");
		expect(article?.querySelector(".skip-body .skip-kind")).toBeNull();
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

	it("is a whole static page with a link back to the Title Screen and no script of its own", () => {
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
		// The builder writes no script: the theme-script plugin puts in the only one (see "saved Theme").
		expect(html).not.toMatch(/<script/i);
		// The arrow is an authored pixel SVG, not a Unicode glyph.
		expect(html).not.toContain("\u2190");
		expect(html).not.toContain("&larr;");
		expect(titleScreen[0]?.querySelector("svg[aria-hidden='true'][shape-rendering='crispEdges']")).not.toBeNull();
	});

	it("uses one heading, Rooms, for the table of contents in both looks", () => {
		const level = loadLevel(
			tiledLevel({ rows: ROWS, extraObjects: [WEST, tiledExhibit("orca", { x: 4, y: 1 }, "west")] }),
		);
		const doc = parse(buildSkipView({ content: [exhibit("orca")], level, base: BASE }));
		expect(doc.querySelector("nav h2")?.textContent).toBe("Rooms");
		expect(doc.querySelector("nav .only-paper, nav .only-board")).toBeNull();
	});

	it("has a page title with no em dash", () => {
		const level = loadLevel(
			tiledLevel({ rows: ROWS, extraObjects: [WEST, tiledExhibit("orca", { x: 4, y: 1 }, "west")] }),
		);
		const doc = parse(buildSkipView({ content: [exhibit("orca")], level, base: BASE }));
		expect(doc.title).toBe("Luan Afonso, portfolio (Skip View)");
		expect(buildSkipView({ content: [exhibit("orca")], level, base: BASE })).not.toContain("\u2014");
	});

	it("follows the system light or dark setting: Paper for light, Board for dark", () => {
		const level = loadLevel(
			tiledLevel({ rows: ROWS, extraObjects: [WEST, tiledExhibit("orca", { x: 4, y: 1 }, "west")] }),
		);
		const doc = parse(buildSkipView({ content: [exhibit("orca")], level, base: BASE }));
		expect(doc.querySelector('meta[name="color-scheme"]')?.getAttribute("content")).toBe("light dark");
		// The script did not run (as when script is blocked): no data-theme, so the CSS follows the system.
		expect(doc.documentElement.hasAttribute("data-theme")).toBe(false);
	});

	it("opens with the datasheet header: part number LA-1, then the name and the lede", () => {
		const level = loadLevel(
			tiledLevel({ rows: ROWS, extraObjects: [WEST, tiledExhibit("orca", { x: 4, y: 1 }, "west")] }),
		);
		const doc = parse(buildSkipView({ content: [exhibit("orca")], level, base: BASE }));
		expect(doc.querySelector(".skip-datasheet .skip-part-number")?.textContent).toBe("LA-1");
		expect(doc.querySelector("h1")?.textContent).toBe("Luan Afonso");
		expect(doc.querySelector(".skip-lede")?.firstChild?.textContent?.trim()).toBe(
			"My portfolio: every Exhibit from the game, Room by Room.",
		);
	});

	it("sets the Dungeon page on the cover: a running head, all Content on the pulp, the back link off it", () => {
		const level = loadLevel(
			tiledLevel({ rows: ROWS, extraObjects: [WEST, tiledExhibit("orca", { x: 4, y: 1 }, "west")] }),
		);
		const doc = parse(buildSkipView({ content: [exhibit("orca")], level, base: BASE }));
		expect(doc.body.classList.contains("dungeon-cover")).toBe(true);
		const pulp = doc.querySelectorAll(".dungeon-pulp");
		expect(pulp).toHaveLength(1);
		const page = pulp[0];
		for (const part of ["h1", "nav", "main"]) expect(page?.querySelector(part)).not.toBeNull();
		expect(page?.querySelector(`a[href="${BASE}"]`)).toBeNull();
		const runningHead = page?.querySelector(".only-dungeon[aria-hidden='true'] + h1")?.previousElementSibling;
		expect([...(runningHead?.children ?? [])].map((span) => span.textContent)).toEqual(["Every page", "Luan Afonso"]);
		const end = page?.lastElementChild;
		expect([end?.textContent, end?.classList.contains("only-dungeon"), end?.getAttribute("aria-hidden")]).toEqual([
			"The end of the book.",
			true,
			"true",
		]);
	});

	it("stamps the lede with Sample content in Dungeon only, as the Exhibit Panel does", () => {
		const level = loadLevel(
			tiledLevel({ rows: ROWS, extraObjects: [WEST, tiledExhibit("orca", { x: 4, y: 1 }, "west")] }),
		);
		const doc = parse(buildSkipView({ content: [exhibit("orca")], level, base: BASE }));
		const stamp = doc.querySelector(".skip-lede > .only-dungeon:last-child");
		expect([stamp?.textContent, stamp?.hasAttribute("aria-hidden")]).toEqual(["Sample content", false]);
	});

	it("links the site icon, so the browser does not ask for a missing favicon.ico", () => {
		const level = loadLevel(
			tiledLevel({ rows: ROWS, extraObjects: [WEST, tiledExhibit("orca", { x: 4, y: 1 }, "west")] }),
		);
		const doc = parse(buildSkipView({ content: [exhibit("orca")], level, base: BASE }));
		// A root path: Vite adds the base path, as it does for every asset URL in a page.
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

	describe("saved Theme", () => {
		/** The real Skip View as Vite builds it: the builder output, then the theme-script plugin. */
		const page = withThemeScript(skipViewPage(BASE));
		const head = page.slice(0, page.indexOf("</head>"));
		const scripts = [...head.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1] ?? "");

		/** Runs the head scripts with the given saved settings (null: none; an Error: blocked storage). Returns the data-theme they set. */
		function shownTheme(saved: string | null | Error): string | undefined {
			const dataset: { theme?: string } = {};
			const localStorage = {
				getItem(key: string) {
					if (saved instanceof Error) throw saved;
					return key === "portfolio.settings.v1" ? saved : null;
				},
			};
			for (const script of scripts) {
				new Function("document", "localStorage", script)({ documentElement: { dataset } }, localStorage);
			}
			return dataset.theme;
		}

		it("has one inline head script, before the stylesheet, so the saved Theme shows before the first paint", () => {
			expect(scripts).toHaveLength(1);
			expect(page.match(/<script/g)).toHaveLength(1);
			expect(head.indexOf("<script>")).toBeLessThan(head.indexOf('rel="stylesheet"'));
		});

		it.each(THEMES)("shows a saved %s Theme", (theme) => {
			expect(shownTheme(JSON.stringify({ sound: true, theme }))).toBe(theme);
		});

		it.each([
			["no saved settings", null],
			["saved settings with no Theme", JSON.stringify({ sound: true })],
			["a saved Theme that is not a Theme", JSON.stringify({ theme: "neon" })],
			["broken saved settings", "{not json"],
			["blocked storage", new Error("Blocked site data.")],
		])("follows the system setting with %s", (_case, saved) => {
			expect(shownTheme(saved)).toBeUndefined();
		});

		it("still shows every Exhibit when script is blocked", () => {
			const doc = parse(page.replace(/<script>[\s\S]*?<\/script>/g, ""));
			const shown = [...doc.querySelectorAll("main article h3")].map((h) => h.textContent);
			expect(shown.sort()).toEqual(EXHIBITS.map((e) => e.title).sort());
		});
	});

	describe("Part labels", () => {
		const level = loadLevel(
			tiledLevel({
				rows: ROWS,
				extraObjects: [
					WEST,
					EAST,
					tiledExhibit("a", { x: 2, y: 0 }, "south"),
					tiledExhibit("b", { x: 4, y: 1 }, "east"),
					tiledExhibit("c", { x: 4, y: 3 }, "west"),
					tiledExhibit("d", { x: 6, y: 0 }, "south"),
				],
			}),
		);

		it("shows U1, J1, R1, Q1 for one Exhibit of each kind", () => {
			const content = [
				exhibit("a", { kind: "project" }),
				exhibit("b", { kind: "contact" }),
				exhibit("c", { kind: "skill" }),
				exhibit("d", { kind: "job" }),
			];
			const doc = parse(buildSkipView({ content, level, base: BASE }));
			const labels = [...doc.querySelectorAll("main article .skip-part")].map((n) => n.textContent);
			expect(labels.sort()).toEqual(["J1", "Q1", "R1", "U1"]);
		});

		it("numbers a second project U2, in Content order", () => {
			const content = [
				exhibit("a", { kind: "project" }),
				exhibit("b", { kind: "contact" }),
				exhibit("c", { kind: "project" }),
				exhibit("d", { kind: "job" }),
			];
			const doc = parse(buildSkipView({ content, level, base: BASE }));
			const byId = (id: string) => doc.getElementById(`exhibit-${id}`)?.querySelector(".skip-part")?.textContent;
			expect(byId("a")).toBe("U1");
			expect(byId("c")).toBe("U2");
		});

		it("heads each Exhibit with a Dungeon section number read as its kind and Part label", () => {
			const content = [
				exhibit("a", { kind: "project" }),
				exhibit("b", { kind: "contact" }),
				exhibit("c", { kind: "skill" }),
				exhibit("d", { kind: "job" }),
			];
			const doc = parse(buildSkipView({ content, level, base: BASE }));
			const sections = ["a", "b", "c", "d"].map((id) => {
				const article = doc.getElementById(`exhibit-${id}`);
				const number = article?.querySelector(".only-dungeon[role='img']");
				const kind = article?.querySelector(".only-dungeon[aria-hidden='true']");
				return [number?.getAttribute("aria-label"), number?.textContent, kind?.textContent];
			});
			expect(sections).toEqual([
				["Project U1", "U1", "Project"],
				["Contact J1", "J1", "Contact"],
				["Skill R1", "R1", "Skill"],
				["Job Q1", "Q1", "Job"],
			]);
		});

		it("lists each Room in a Contents list with an anchor link and its Part labels", () => {
			const content = [
				exhibit("a", { kind: "project" }),
				exhibit("b", { kind: "contact" }),
				exhibit("c", { kind: "project" }),
				exhibit("d", { kind: "job" }),
			];
			const doc = parse(buildSkipView({ content, level, base: BASE }));
			const items = [...doc.querySelectorAll("nav[aria-label='Contents'] li")].map((li) => {
				const href = li.querySelector("a")?.getAttribute("href") ?? "";
				return [
					li.querySelector("a .skip-contents-room")?.textContent,
					doc.querySelector(href)?.tagName,
					li.querySelector("a .skip-contents-parts")?.textContent,
				];
			});
			expect(items).toEqual([
				["West Wing", "H2", "U1, U2"],
				["East Wing", "H2", "J1, Q1"],
			]);
		});
	});
});
