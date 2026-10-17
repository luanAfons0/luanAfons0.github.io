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

describe("Audio art set change", () => {
	/** The URL of each buffer played, in order. Each fake WAV holds its own URL. */
	const played: string[] = [];
	let gain: { value: number } = { value: 1 };

	class NamingAudioContext {
		state = "running";
		destination = {};
		createGain() {
			gain = { value: 1 };
			return { gain, connect: () => {} };
		}
		decodeAudioData(bytes: ArrayBuffer) {
			return Promise.resolve({ url: new TextDecoder().decode(bytes) });
		}
		createBufferSource() {
			const source = {
				buffer: undefined as { url: string } | undefined,
				connect: () => {},
				start: () => played.push(source.buffer?.url ?? "none"),
			};
			return source;
		}
	}

	function stubWebAudio() {
		played.length = 0;
		vi.stubGlobal("AudioContext", NamingAudioContext);
		const fetch = vi.fn((url: string) => Promise.resolve(new Response(new TextEncoder().encode(url))));
		vi.stubGlobal("fetch", fetch);
		return fetch;
	}

	/** Lets the fake fetches and decodes finish. */
	const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

	it("loads the sounds of the new art set, then plays them", async () => {
		const fetch = stubWebAudio();
		const audio = createAudio("/", MACHINE_ART_SET);
		audio.start();
		await settle();
		audio.play("shot");

		audio.changeArtSet(DUNGEON_ART_SET);
		expect(fetch.mock.calls.map(([url]) => url)).toContain("/dungeon/sounds/door-open.wav");
		await settle();
		audio.play("shot");

		expect(played).toEqual(["/machine/sounds/shot.wav", "/dungeon/sounds/shot.wav"]);
	});

	it("plays the old sounds until the new ones are loaded", async () => {
		stubWebAudio();
		const audio = createAudio("/", MACHINE_ART_SET);
		audio.start();
		await settle();

		audio.changeArtSet(DUNGEON_ART_SET);
		audio.play("shot");

		expect(played).toEqual(["/machine/sounds/shot.wav"]);
	});

	it("loads nothing before start, and then loads the sounds of the last art set", async () => {
		const fetch = stubWebAudio();
		const audio = createAudio("/", MACHINE_ART_SET);
		audio.changeArtSet(DUNGEON_ART_SET);
		expect(fetch).not.toHaveBeenCalled();

		audio.start();
		await settle();
		audio.play("door-open");

		expect(played).toEqual(["/dungeon/sounds/door-open.wav"]);
	});

	it("plays the art set chosen last when an older load ends later", async () => {
		stubWebAudio();
		const audio = createAudio("/", MACHINE_ART_SET);
		audio.start();
		audio.changeArtSet(DUNGEON_ART_SET);
		audio.changeArtSet(MACHINE_ART_SET);
		await settle();
		audio.play("shot");

		expect(played).toEqual(["/machine/sounds/shot.wav"]);
	});

	/** Like stubWebAudio, but the first fetch of each URL in `failing` answers HTTP 404. */
	function stubWebAudioFailingOnce(failing: readonly string[]) {
		const fetch = stubWebAudio();
		const failed = new Set<string>();
		fetch.mockImplementation((url: string) => {
			if (failing.includes(url) && !failed.has(url)) {
				failed.add(url);
				return Promise.resolve(new Response(null, { status: 404 }));
			}
			return Promise.resolve(new Response(new TextEncoder().encode(url)));
		});
		vi.spyOn(console, "error").mockImplementation(() => {});
		return fetch;
	}

	it("loads a sound that failed to load again on the next start", async () => {
		stubWebAudioFailingOnce(["/machine/sounds/shot.wav"]);
		const audio = createAudio("/", MACHINE_ART_SET);
		audio.start();
		await settle();
		audio.play("shot");

		audio.start();
		await settle();
		audio.play("shot");

		expect(played).toEqual(["/machine/sounds/shot.wav"]);
	});

	it("loads the sounds of an art set that failed to load again on the next change to it", async () => {
		const fetch = stubWebAudioFailingOnce(["/dungeon/sounds/shot.wav"]);
		const audio = createAudio("/", MACHINE_ART_SET);
		audio.start();
		audio.changeArtSet(DUNGEON_ART_SET);
		await settle();
		audio.changeArtSet(MACHINE_ART_SET);
		audio.changeArtSet(DUNGEON_ART_SET);
		await settle();
		audio.play("shot");

		expect(fetch.mock.calls.filter(([url]) => url === "/dungeon/sounds/shot.wav")).toHaveLength(2);
		expect(played).toEqual(["/dungeon/sounds/shot.wav"]);
	});

	it("keeps mute through the change", async () => {
		stubWebAudio();
		const audio = createAudio("/", MACHINE_ART_SET);
		audio.start();
		audio.setMuted(true);

		audio.changeArtSet(DUNGEON_ART_SET);
		await settle();
		audio.play("shot");

		expect(played).toEqual([]);
		expect(gain.value).toBe(0);
		audio.setMuted(false);
		audio.play("shot");
		expect(played).toEqual(["/dungeon/sounds/shot.wav"]);
	});
});
