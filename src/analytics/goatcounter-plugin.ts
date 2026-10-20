import type { Plugin } from "vite";
import { goatCounterScriptTag } from "./analytics";

/**
 * Puts the GoatCounter script tag at the end of the head of the page. Build only: the dev server and the
 * tests never load it, so local work is not counted.
 */
export function goatCounter(): Plugin {
	return {
		name: "goatcounter",
		apply: "build",
		transformIndexHtml: {
			order: "post",
			handler: (html: string) => html.replace("</head>", `${goatCounterScriptTag()}</head>`),
		},
	};
}
