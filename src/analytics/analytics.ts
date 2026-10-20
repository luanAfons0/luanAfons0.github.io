// Type imports only: analytics must not load the Home page code at run time.
import type { Lang } from "../home/copy";
import type { PackageKey } from "../home/offer";

/** The GoatCounter site code. Change it here only. */
export const GOATCOUNTER_SITE = "luanafons0";

/** The script tag the production build puts in the head of the page. */
export function goatCounterScriptTag(): string {
	return `<script data-goatcounter="https://${GOATCOUNTER_SITE}.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>`;
}

/**
 * An analytics event of the Home page. Its name is an event path: it must not start with "/".
 * These are all the events of the spec (#51). Send no other events.
 * - `book-call`: a click on a Book a call link.
 * - `whatsapp`: a click on the WhatsApp link of the hero.
 * - `lang/<id>`: the visitor changes the language.
 * - `add/<package>`: an "Add to project" button puts a Package in the Project builder (not when it takes it out).
 * - `form-ready`: a valid submit of the contact form.
 */
export type AnalyticsEvent = "book-call" | "whatsapp" | `lang/${Lang}` | `add/${PackageKey}` | "form-ready";

/** Sends one event to GoatCounter. A blocked or missing script, or a script that throws, never breaks the site. */
export function track(event: AnalyticsEvent): void {
	try {
		window.goatcounter?.count?.({ path: event, title: event, event: true });
	} catch {
		// Analytics must never break the site.
	}
}
