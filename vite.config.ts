import { type Plugin, runnerImport } from "vite";
import { defineConfig } from "vitest/config";
import { goatCounterScriptTag } from "./src/analytics/analytics";

export default defineConfig({
	base: "/portfolio/",
	// Two pages: the Title Screen (it loads the game) and the Skip View (no script at all).
	input: { title: "index.html", skip: "skip/index.html" },
	plugins: [skipView(), goatCounter()],
	build: {
		target: "es2022",
	},
	test: {
		include: ["src/**/*.test.ts", "scripts/**/*.test.{ts,mjs}"],
	},
});

/**
 * Replaces `skip/index.html` with the Skip View, made from the Content and the Level by the
 * Skip View builder. It loads the builder through Vite, so a Content edit shows on the next reload.
 */
function skipView(): Plugin {
	let base = "/";
	return {
		name: "skip-view",
		configResolved(config) {
			base = config.base;
		},
		transformIndexHtml: {
			order: "pre",
			async handler(_html, { filename }) {
				if (!filename.endsWith("/skip/index.html")) return;
				const { module } = await runnerImport<{ skipViewPage(base: string): string }>("/src/skip-view/page.ts", {
					configFile: false,
					logLevel: "silent",
				});
				return module.skipViewPage(base);
			},
		},
	};
}

/**
 * Puts the GoatCounter script tag in the head of both pages. Build only: the dev server and the
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
