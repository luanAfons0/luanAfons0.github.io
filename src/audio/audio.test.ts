import { afterEach, describe, expect, it, vi } from "vitest";
import { DUNGEON_ART_SET, MACHINE_ART_SET } from "../game/theme";
import { createAudio } from "./audio";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("Audio without Web Audio", () => {
	it("starts silently when the browser has no AudioContext, and logs the problem once", () => {
		vi.stubGlobal("AudioContext", undefined);
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		const audio = createAudio("/", MACHINE_ART_SET);

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
		const audio = createAudio("/", MACHINE_ART_SET);

		expect(() => audio.start()).not.toThrow();
		expect(() => audio.play("door-open")).not.toThrow();
	});
});

describe("Audio sounds", () => {
	/** A Web Audio stand-in: it decodes any bytes and records nothing else. */
	class FakeAudioContext {
		state = "running";
		destination = {};
		createGain() {
			return { gain: { value: 1 }, connect: () => {} };
		}
		decodeAudioData() {
			return Promise.resolve({});
		}
	}

	it.each([
		{
			artSet: MACHINE_ART_SET,
			urls: ["/portfolio/machine/sounds/shot.wav", "/portfolio/machine/sounds/door-open.wav"],
		},
		{
			artSet: DUNGEON_ART_SET,
			urls: ["/portfolio/dungeon/sounds/shot.wav", "/portfolio/dungeon/sounds/door-open.wav"],
		},
	])("loads the sounds of the $artSet.name art set from its sounds folder on start", ({ artSet, urls }) => {
		vi.stubGlobal("AudioContext", FakeAudioContext);
		const fetch = vi.fn((_url: string) => Promise.resolve(new Response(new ArrayBuffer(8))));
		vi.stubGlobal("fetch", fetch);
		const audio = createAudio("/portfolio/", artSet);
		expect(fetch).not.toHaveBeenCalled();

		audio.start();

		expect(fetch.mock.calls.map(([url]) => url)).toEqual(urls);
	});
});
