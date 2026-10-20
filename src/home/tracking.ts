// The analytics events for the Book a call links and the WhatsApp link.
import { track } from "../analytics/analytics";
import type { HomeContext } from "./home";

/** Sends `book-call` for a click on a Book a call link, and `whatsapp` for a click on the WhatsApp link of the hero. */
export function mountTracking({ doc, signal }: HomeContext): void {
	doc.addEventListener(
		"click",
		(e) => {
			const link = e.target instanceof Element ? e.target.closest("a") : null;
			if (!link) return;
			if (link.querySelector('[data-t="cta.book"]')) track("book-call");
			else if (link.matches(".hero-cta .text-link")) track("whatsapp");
		},
		{ signal },
	);
}
