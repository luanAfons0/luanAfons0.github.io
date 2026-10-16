import { EXHIBITS } from "../game/content";
import { loadLevel } from "../game/level";
import sampleLevel from "../game/levels/sample.json";
import { buildSkipView } from "./skip-view";

/** The real Skip View page: the real Content and the real Level. Vite runs it at build time. */
export function skipViewPage(base: string): string {
	return buildSkipView({
		content: EXHIBITS,
		level: loadLevel(sampleLevel),
		base,
		stylesheet: "/src/skip-view/skip-view.css",
	});
}
