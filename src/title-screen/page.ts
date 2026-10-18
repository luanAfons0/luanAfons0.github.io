import { type Level, loadLevel } from "../game/level";
import sampleLevel from "../game/levels/sample.json";
import { THEME_LABELS, THEMES } from "../game/theme";

/**
 * The real Title Screen page: index.html with the Features counts (Rooms, Exhibits, Bugs) of the
 * Level put in, so they never go stale: the Features line of Paper (`<!--level-features-->`) and the
 * stat boxes of Dungeon (`<!--level-rooms-->`, `<!--level-exhibits-->`, `<!--level-bugs-->`). It
 * also puts one option per Theme (`THEMES`, named by `THEME_LABELS`) into the Theme item
 * (`<!--theme-options-->`), so the select never misses a Theme. Vite runs it at build time, and the
 * tests run it on the real index.html. It has game code, so the Title Screen page never imports it.
 * It fails when the page has no mark for a count or for the Theme options.
 */
export function titleScreenPage(
	html: string,
	level: Pick<Level, "rooms" | "exhibits" | "bugSpawns"> = loadLevel(sampleLevel),
): string {
	const [rooms, exhibits, bugs] = [level.rooms.length, level.exhibits.length, level.bugSpawns.length];
	const marks: Readonly<Record<string, string>> = {
		"level-features": [count(rooms, "Room"), count(exhibits, "Exhibit"), `${count(bugs, "Bug")} to fix`].join(", "),
		"level-rooms": `${rooms}`,
		"level-exhibits": `${exhibits}`,
		"level-bugs": `${bugs}`,
		"theme-options": THEMES.map((theme) => `<option value="${theme}">${THEME_LABELS[theme]}</option>`).join(""),
	};
	let page = html;
	for (const [name, value] of Object.entries(marks)) {
		const mark = `<!--${name}-->`;
		if (!page.includes(mark)) throw new Error(`The Title Screen has no ${mark} mark.`);
		page = page.replace(mark, value);
	}
	return page;
}

function count(n: number, noun: string): string {
	return `${n} ${noun}${n === 1 ? "" : "s"}`;
}
