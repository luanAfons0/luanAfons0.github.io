/**
 * The Audio: the sound effects of the art set through Web Audio. There is no music.
 * The Game core only reports sound events; this module plays them in the browser. Manual test only.
 * The browser allows sound only after a user gesture, so `start()` must run inside the NEW GAME
 * click or key press. Nothing is created or loaded before that: the Title Screen stays light.
 */

import type { ArtSet, SoundEvent } from "../game/theme";

export type { SoundEvent } from "../game/theme";

export interface Audio {
	/**
	 * Creates the audio context, or resumes it when the browser suspended it, and starts to load the
	 * sounds. Call it inside a user gesture. It is safe to call again. It never throws: without Web
	 * Audio, it logs the problem once and the game stays silent.
	 */
	start(): void;
	/** Plays the sound of an event. It does nothing before start(), while muted, or before the sound is loaded. */
	play(event: SoundEvent): void;
	/** Mutes or unmutes all sound. */
	setMuted(muted: boolean): void;
	/**
	 * Plays the sounds of another art set. After start(), it loads them (once, then from a cache) and
	 * plays the old sounds until they are loaded. Before start(), start() loads them. Mute stays.
	 */
	changeArtSet(artSet: ArtSounds): void;
}

/** The parts of an art set that the Audio uses. */
export type ArtSounds = Pick<ArtSet, "folders" | "sounds">;

type Buffers = Partial<Record<SoundEvent, AudioBuffer>>;

/**
 * The Audio of an art set: the sound of each event is `<baseUrl><sounds folder>/<file>.wav`, where
 * the art set names the folder and the file. `baseUrl` is the base path of the site, such as `/portfolio/`.
 */
export function createAudio(baseUrl: string, initialArtSet: ArtSounds): Audio {
	let artSet = initialArtSet;
	let context: AudioContext | undefined;
	let output: GainNode | undefined;
	let muted = false;
	/** True once Web Audio failed: the Audio then stays silent and does not log again. */
	let unavailable = false;
	/** The sounds that play: those of the art set, once they are loaded. */
	let buffers: Buffers = {};
	/** The sound load of each art set, so each loads once. */
	const loads = new Map<ArtSounds, Promise<Buffers>>();

	async function load(audio: AudioContext, art: ArtSounds, event: SoundEvent): Promise<AudioBuffer> {
		const response = await fetch(`${baseUrl}${art.folders.sounds}/${art.sounds[event]}.wav`);
		if (!response.ok) throw new Error(`Cannot load the "${event}" sound: HTTP ${response.status}.`);
		return audio.decodeAudioData(await response.arrayBuffer());
	}

	/** Loads every sound of an art set. A sound that fails to load stays silent; the game goes on. */
	function loadAll(audio: AudioContext, art: ArtSounds): Promise<Buffers> {
		let all = loads.get(art);
		if (!all) {
			const events = Object.keys(art.sounds) as SoundEvent[];
			all = Promise.all(
				events.map((event) =>
					load(audio, art, event).then(
						(buffer) => [event, buffer] as const,
						(error: unknown) => {
							console.error(error);
							return undefined;
						},
					),
				),
			).then((entries) => Object.fromEntries(entries.filter((entry) => entry !== undefined)));
			loads.set(art, all);
		}
		return all;
	}

	/** Plays the sounds of the art set once they are loaded, unless the art set changed again before. */
	function useArtSet(audio: AudioContext): void {
		const wanted = artSet;
		void loadAll(audio, wanted).then((loaded) => {
			if (artSet === wanted) buffers = loaded;
		});
	}

	return {
		start() {
			if (unavailable) return;
			// Sound must never block the game: a browser without Web Audio (or with it turned off) throws here.
			try {
				if (context) {
					// A refused resume is not an error: the next user gesture tries again.
					if (context.state !== "running") context.resume().catch(() => {});
					return;
				}
				const created = new AudioContext();
				output = created.createGain();
				output.gain.value = muted ? 0 : 1;
				output.connect(created.destination);
				context = created;
			} catch (error) {
				unavailable = true;
				console.error("No sound: Web Audio is not available.", error);
				return;
			}
			useArtSet(context);
		},
		play(event) {
			const buffer = buffers[event];
			if (!context || !output || muted || !buffer) return;
			const source = context.createBufferSource();
			source.buffer = buffer;
			source.connect(output);
			source.start();
		},
		setMuted(value) {
			muted = value;
			if (output) output.gain.value = muted ? 0 : 1;
		},
		changeArtSet(next) {
			artSet = next;
			if (context) useArtSet(context);
		},
	};
}
