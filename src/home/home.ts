// The Home page mount: the one seam that starts the page on a document.
import { mountBuilder } from "./builder";
import { mountContact } from "./contact";
import { mountFilmstrip } from "./filmstrip";
import { createLanguage, type Language } from "./language";
import { mountPageMap } from "./page-map";
import { mountScroll, type Scroll } from "./scroll";
import { mountTracking } from "./tracking";

/** What each part of the page gets from the mount. */
export interface HomeContext {
	doc: Document;
	win: Window & typeof globalThis;
	/** Aborts every listener, observer, animation frame loop and timer of the page. */
	signal: AbortSignal;
	language: Language;
	scroll: Scroll;
}

/** A mounted Home page. */
export interface Home {
	/** Stops the page: every listener, observer, animation frame loop and timer. */
	dispose(): void;
}

/** Starts the Home page on `doc`. Each part starts in the order of the mock. */
export function mountHome(doc: Document = document): Home {
	const win = doc.defaultView;
	if (!win) throw new Error("mountHome needs a document with a window");
	const controller = new AbortController();
	const signal = controller.signal;

	doc.documentElement.classList.add("js");

	// First: the Twin copy must exist before the first render, so that each later query also reaches it.
	const scroll = mountScroll(doc, signal);

	const language = createLanguage(doc, signal);
	const ctx: HomeContext = { doc, win, signal, language, scroll };

	mountFilmstrip(ctx);

	mountPageMap(ctx);

	mountBuilder(ctx);

	mountContact(ctx);

	mountTracking(ctx);

	// The first render, after every part has added its onChange function (mock line 1040).
	language.apply();

	return { dispose: () => controller.abort() };
}
