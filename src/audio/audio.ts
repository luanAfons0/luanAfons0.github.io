/**
 * The Audio: Freedoom sound effects through Web Audio. There is no music.
 * The Game core only reports sound events; this module plays them in the browser. Manual test only.
 * The browser allows sound only after a user gesture, so `start()` must run inside the NEW GAME
 * click or key press. Nothing is created or loaded before that: the Title Screen stays light.
 */

/** The sound events of the Game core. */
export type SoundEvent = "shot" | "door-open";

/** The Freedoom sound of each event, a WAV in public/freedoom/sounds/. */
const SOUND_FILES: Record<SoundEvent, string> = { shot: "DSPISTOL", "door-open": "DSDOROPN" };

export interface Audio {
	/**
	 * Creates the audio context, or resumes it when the browser suspended it, and starts to load the
	 * sounds. Call it inside a user gesture. It is safe to call again.
	 */
	start(): void;
	/** Plays the sound of an event. It does nothing before start(), while muted, or before the sound is loaded. */
	play(event: SoundEvent): void;
	/** Mutes or unmutes all sound. */
	setMuted(muted: boolean): void;
}

/** The Audio, with the sounds at `<soundsUrl>/<NAME>.wav`. */
export function createAudio(soundsUrl: string): Audio {
	let context: AudioContext | undefined;
	let output: GainNode | undefined;
	let muted = false;
	const buffers: Partial<Record<SoundEvent, AudioBuffer>> = {};

	async function load(audio: AudioContext, event: SoundEvent): Promise<void> {
		const response = await fetch(`${soundsUrl}/${SOUND_FILES[event]}.wav`);
		if (!response.ok) throw new Error(`Cannot load the "${event}" sound: HTTP ${response.status}.`);
		buffers[event] = await audio.decodeAudioData(await response.arrayBuffer());
	}

	return {
		start() {
			if (context) {
				if (context.state !== "running") void context.resume();
				return;
			}
			context = new AudioContext();
			output = context.createGain();
			output.gain.value = muted ? 0 : 1;
			output.connect(context.destination);
			for (const event of Object.keys(SOUND_FILES) as SoundEvent[]) {
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
