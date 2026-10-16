import { defineConfig } from "vitest/config";

export default defineConfig({
	base: "/portfolio/",
	build: {
		target: "es2022",
	},
	test: {
		include: ["src/**/*.test.ts", "scripts/**/*.test.mjs"],
	},
});
