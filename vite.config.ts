import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import { goatCounterScriptTag } from "./src/analytics/analytics";

export default defineConfig({
	base: "/portfolio/",
	plugins: [goatCounter()],
	build: {
		target: "es2022",
	},
	test: {
		include: ["src/**/*.test.ts", "scripts/**/*.test.mjs"],
	},
});

/**
 * Puts the GoatCounter script tag in the head of the page. Build only: the dev server and the
 * tests never load it, so local work is not counted.
 */
function goatCounter(): Plugin {
	return {
		name: "goatcounter",
		apply: "build",
		transformIndexHtml: {
			order: "post",
			handler: (html) => html.replace("</head>", `${goatCounterScriptTag()}</head>`),
		},
	};
}
