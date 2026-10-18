/**
 * The sound effects: short electronic sounds for the board world, synthesized sample by sample.
 * `shot` is a zap that falls in pitch. `door-open` is an actuator that hums up and ends in a soft
 * clunk. The noise comes from a seeded generator, so every run gives the same bytes. The art set
 * in `src/game/theme.ts` lists the same file names.
 */
import { attack, fadeOut, normalize, render, seededNoise, smoothstep } from "../art-kit/synth.ts";
import { type GeneratedFile, SAMPLE_RATE, wavFile } from "./files.ts";

/** The loudest sample of each sound, under full scale so it does not clip after decoding. */
const PEAK = 0.8;

const SOUNDS: Readonly<Record<string, () => Float32Array>> = {
	shot,
	"door-open": doorOpen,
};

export function sounds(): GeneratedFile[] {
	return Object.entries(SOUNDS).map(([name, render]) => wavFile(`sounds/${name}.wav`, normalize(render(), PEAK)));
}

/** The zap: a square wave that falls from about 1.6 kHz to 180 Hz in 0.16 s, over a short noise click. */
function shot(): Float32Array {
	const noise = seededNoise(0x5ca1ab1e);
	let phase = 0;
	return render(0.16, (t, duration) => {
		phase += (180 + 1400 * Math.exp(-t * 22)) / SAMPLE_RATE;
		const square = phase % 1 < 0.5 ? 1 : -1;
		const body = square * attack(t, 0.002) * (1 - t / duration) ** 2;
		return 0.7 * body + 0.4 * noise() * Math.exp(-t * 90);
	});
}

/** The door: a hum that rises from 70 Hz to 120 Hz with filtered air, then a clunk when it stops. */
function doorOpen(): Float32Array {
	const noise = seededNoise(0xd00d);
	const slide = 0.6;
	let phase = 0;
	let air = 0;
	return render(0.78, (t, duration) => {
		const rise = smoothstep(Math.min(t / slide, 1));
		phase += (70 + 50 * rise) / SAMPLE_RATE;
		const saw = 2 * (phase % 1) - 1;
		const harmonic = Math.sin(2 * Math.PI * 2 * phase);
		const tremolo = 1 + 0.15 * Math.sin(2 * Math.PI * 28 * t);
		const hum = t < slide ? (0.5 * saw + 0.3 * harmonic) * tremolo * attack(t, 0.03) * fadeOut(t, slide, 0.08) : 0;
		air += 0.08 * (noise() - air); // a one-pole low-pass filter
		const hiss = t < slide ? 1.6 * air * fadeOut(t, slide, 0.15) : 0;
		const since = t - slide;
		const clunk =
			since < 0
				? 0
				: Math.sin(2 * Math.PI * 90 * since) * Math.exp(-since * 30) + 0.5 * noise() * Math.exp(-since * 400);
		return hum + hiss + clunk * fadeOut(t, duration, 0.03);
	});
}
