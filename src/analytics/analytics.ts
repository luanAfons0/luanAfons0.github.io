import type { Theme } from "../game/theme";

/** The GoatCounter site code. Change it here only. */
export const GOATCOUNTER_SITE = "luanafons0";

/** The script tag the production build puts in the head of both pages. */
export function goatCounterScriptTag(): string {
	return `<script data-goatcounter="https://${GOATCOUNTER_SITE}.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>`;
}

/** The analytics events. Each name is an event path: it must not start with "/". */
export type AnalyticsEvent = "new-game" | "skip" | "all-bugs-fixed" | `exhibit/${string}` | `theme/${Theme}`;

/** Sends one event to GoatCounter. A blocked or missing script, or a script that throws, never breaks the site. */
export function track(event: AnalyticsEvent): void {
	try {
		window.goatcounter?.count?.({ path: event, title: event, event: true });
	} catch {
		// Analytics must never break the site.
	}
}
