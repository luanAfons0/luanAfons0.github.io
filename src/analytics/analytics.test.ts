// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { goatCounterScriptTag, track } from "./analytics";

afterEach(() => {
	delete window.goatcounter;
});

describe("analytics track", () => {
	it("counts an event with the given name as the path", () => {
		const count = vi.fn();
		window.goatcounter = { count };

		track("lang/pt");

		expect(count).toHaveBeenCalledWith({ path: "lang/pt", title: "lang/pt", event: true });
	});

	it("does not throw when the script is blocked or not loaded yet", () => {
		expect(() => track("form-ready")).not.toThrow();
		window.goatcounter = {};
		expect(() => track("form-ready")).not.toThrow();
	});

	it("does not throw when the script throws", () => {
		window.goatcounter = {
			count: () => {
				throw new Error("boom");
			},
		};
		expect(() => track("form-ready")).not.toThrow();
	});
});

describe("GoatCounter script tag", () => {
	it("points at the site endpoint and loads async", () => {
		const tag = goatCounterScriptTag();
		expect(tag).toContain('data-goatcounter="https://luanafons0.goatcounter.com/count"');
		expect(tag).toContain("async");
		expect(tag).toContain('src="https://gc.zgo.at/count.js"');
	});
});
