/** The GoatCounter site code. Change it here only. */
export const GOATCOUNTER_SITE = "luanafons0";

/** The script tag the production build puts in the head of the page. */
export function goatCounterScriptTag(): string {
	return `<script data-goatcounter="https://${GOATCOUNTER_SITE}.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>`;
}

/**
 * An analytics event. Its name is an event path: it must not start with "/".
 * The home page has no events yet; make this a union of its event names when it gets them.
 */
export type AnalyticsEvent = string;

/** Sends one event to GoatCounter. A blocked or missing script, or a script that throws, never breaks the site. */
export function track(event: AnalyticsEvent): void {
	try {
		window.goatcounter?.count?.({ path: event, title: event, event: true });
	} catch {
		// Analytics must never break the site.
	}
}
