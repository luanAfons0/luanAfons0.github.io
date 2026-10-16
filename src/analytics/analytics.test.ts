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

		track("exhibit/orca");

		expect(count).toHaveBeenCalledWith({ path: "exhibit/orca", title: "exhibit/orca", event: true });
	});

	it("does not throw when the script is blocked or not loaded yet", () => {
		expect(() => track("skip")).not.toThrow();
		window.goatcounter = {};
		expect(() => track("skip")).not.toThrow();
	});

	it("does not throw when the script throws", () => {
		window.goatcounter = {
			count: () => {
				throw new Error("boom");
			},
		};
		expect(() => track("new-game")).not.toThrow();
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
