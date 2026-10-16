import { afterEach, describe, expect, it, vi } from "vitest";
import { createAudio } from "./audio";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("Audio without Web Audio", () => {
	it("starts silently when the browser has no AudioContext, and logs the problem once", () => {
		vi.stubGlobal("AudioContext", undefined);
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		const audio = createAudio("/sounds");

		expect(() => {
			audio.start();
			audio.start();
			audio.play("shot");
			audio.setMuted(true);
		}).not.toThrow();
		expect(log).toHaveBeenCalledTimes(1);
	});

	it("starts silently when the browser refuses to create the AudioContext", () => {
		vi.stubGlobal(
			"AudioContext",
			class {
				constructor() {
					throw new DOMException("Web Audio is off.", "NotSupportedError");
				}
			},
		);
		vi.spyOn(console, "error").mockImplementation(() => {});
		const audio = createAudio("/sounds");

		expect(() => audio.start()).not.toThrow();
		expect(() => audio.play("door-open")).not.toThrow();
	});
});
