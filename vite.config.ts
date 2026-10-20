import { defineConfig } from "vitest/config";
import { goatCounter } from "./src/analytics/goatcounter-plugin.ts";

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
