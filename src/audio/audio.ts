/**
 * The Audio: the sound effects of the art set through Web Audio. There is no music.
 * The Game core only reports sound events; this module plays them in the browser. Manual test only.
 * The browser allows sound only after a user gesture, so `start()` must run inside the NEW GAME
 * click or key press. Nothing is created or loaded before that: the Title Screen stays light.
 */

import { type ArtSet, MACHINE_ART_SET, type SoundEvent } from "../game/theme";

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
}

/**
 * The Audio, with the sound of each event at `<soundsUrl>/<file>.wav`, where `sounds` names the
 * file (default: the machine art set).
 */
export function createAudio(soundsUrl: string, sounds: ArtSet["sounds"] = MACHINE_ART_SET.sounds): Audio {
	let context: AudioContext | undefined;
	let output: GainNode | undefined;
	let muted = false;
	/** True once Web Audio failed: the Audio then stays silent and does not log again. */
	let unavailable = false;
	const buffers: Partial<Record<SoundEvent, AudioBuffer>> = {};

	async function load(audio: AudioContext, event: SoundEvent): Promise<void> {
		const response = await fetch(`${soundsUrl}/${sounds[event]}.wav`);
		if (!response.ok) throw new Error(`Cannot load the "${event}" sound: HTTP ${response.status}.`);
		buffers[event] = await audio.decodeAudioData(await response.arrayBuffer());
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
			for (const event of Object.keys(sounds) as SoundEvent[]) {
				// A sound that fails to load stays silent; the game goes on.
				load(context, event).catch((error: unknown) => console.error(error));
			}
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
	};
}
