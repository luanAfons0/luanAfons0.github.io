import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** The real `index.html`, as the browser gets it. */
export const HOME_HTML = readFileSync(resolve(import.meta.dirname, "../../../index.html"), "utf8");

/** The body of the Home page without its script tag: the static markup that the mount starts on. */
export const HOME_BODY = HOME_HTML.slice(
	HOME_HTML.indexOf("<body>") + "<body>".length,
	HOME_HTML.indexOf("</body>"),
).replace(/<script[\s\S]*?<\/script>/g, "");

/** The `lang` on the root of the real page, before any script runs. */
const HOME_LANG = /<html[^>]*\slang="([^"]*)"/.exec(HOME_HTML)?.[1] ?? "";

/**
 * Puts the Home page markup in `doc`, as the page loads it with no script run yet.
 * It also resets the root, because happy-dom keeps one document for all the tests of a file.
 */
export function loadHomeBody(doc: Document = document): void {
	const root = doc.documentElement;
	root.removeAttribute("class");
	root.lang = HOME_LANG;
	doc.body.innerHTML = HOME_BODY;
}
