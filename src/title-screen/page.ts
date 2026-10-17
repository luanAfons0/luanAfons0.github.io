import { type Level, loadLevel } from "../game/level";
import sampleLevel from "../game/levels/sample.json";

/**
 * The real Title Screen page: index.html with the Features counts (Rooms, Exhibits, Bugs) of the
 * Level put in, so they never go stale: the Features line of Paper (`<!--level-features-->`) and the
 * stat boxes of Dungeon (`<!--level-rooms-->`, `<!--level-exhibits-->`, `<!--level-bugs-->`). Vite
 * runs it at build time, and the tests run it on the real index.html. It has game code, so the
 * Title Screen page never imports it. It fails when the page has no mark for a count.
 */
export function titleScreenPage(
	html: string,
	level: Pick<Level, "rooms" | "exhibits" | "bugSpawns"> = loadLevel(sampleLevel),
): string {
	const [rooms, exhibits, bugs] = [level.rooms.length, level.exhibits.length, level.bugSpawns.length];
	const counts: Readonly<Record<string, string>> = {
		"level-features": [count(rooms, "Room"), count(exhibits, "Exhibit"), `${count(bugs, "Bug")} to fix`].join(", "),
		"level-rooms": `${rooms}`,
		"level-exhibits": `${exhibits}`,
		"level-bugs": `${bugs}`,
	};
	let page = html;
	for (const [name, value] of Object.entries(counts)) {
		const mark = `<!--${name}-->`;
		if (!page.includes(mark)) throw new Error(`The Title Screen has no ${mark} mark.`);
		page = page.replace(mark, value);
	}
	return page;
}

function count(n: number, noun: string): string {
	return `${n} ${noun}${n === 1 ? "" : "s"}`;
}
