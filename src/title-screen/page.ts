import { type Level, loadLevel } from "../game/level";
import sampleLevel from "../game/levels/sample.json";

/** The mark in index.html that the Level counts replace. */
const LEVEL_FEATURES = "<!--level-features-->";

/**
 * The real Title Screen page: index.html with the Features counts (Rooms, Exhibits, Bugs) of the
 * Level put in, so they never go stale. Vite runs it at build time, and the tests run it on the real
 * index.html. It has game code, so the Title Screen page never imports it.
 */
export function titleScreenPage(
	html: string,
	level: Pick<Level, "rooms" | "exhibits" | "bugSpawns"> = loadLevel(sampleLevel),
): string {
	if (!html.includes(LEVEL_FEATURES)) throw new Error(`The Title Screen has no ${LEVEL_FEATURES} mark.`);
	const features = [
		count(level.rooms.length, "Room"),
		count(level.exhibits.length, "Exhibit"),
		`${count(level.bugSpawns.length, "Bug")} to fix`,
	].join(", ");
	return html.replace(LEVEL_FEATURES, features);
}

function count(n: number, noun: string): string {
	return `${n} ${noun}${n === 1 ? "" : "s"}`;
}
