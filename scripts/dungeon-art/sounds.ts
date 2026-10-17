/**
 * The sound effects in a dungeon voice, synthesized sample by sample. `shot` is a soft, wet splat.
 * `door-open` is a wooden creak that ends in a stone thud. The noise comes from a seeded generator,
 * so every run gives the same bytes. The art set in `src/game/theme.ts` lists the same file names.
 */
import { attack, fadeOut, normalize, render, seededNoise } from "../art-kit/synth.ts";
import { type GeneratedFile, SAMPLE_RATE, wavFile } from "./files.ts";

/** The loudest sample of each sound, under full scale so it does not clip after decoding. */
const PEAK = 0.8;

const SOUNDS: Readonly<Record<string, () => Float32Array>> = {
	shot,
	"door-open": doorOpen,
};

export function sounds(): GeneratedFile[] {
	return Object.entries(SOUNDS).map(([name, draw]) => wavFile(`sounds/${name}.wav`, normalize(draw(), PEAK)));
}

/**
 * The splat: a burst of low-passed noise, a sine "bloop" that falls from 420 Hz to 90 Hz, and a
 * few small wet ticks after it, in 0.24 s.
 */
function shot(): Float32Array {
	const noise = seededNoise(0x51a7);
	let phase = 0;
	let wet = 0;
	return render(0.24, (t, duration) => {
		phase += (90 + 330 * Math.exp(-t * 28)) / SAMPLE_RATE;
		const bloop = Math.sin(2 * Math.PI * phase) * attack(t, 0.003) * Math.exp(-t * 18);
		wet += 0.18 * (noise() - wet); // a one-pole low-pass filter
		const burst = 2.2 * wet * Math.exp(-t * 40);
		const drip = [0.07, 0.11, 0.16].reduce(
			(sum, at) => sum + (t >= at ? Math.sin(2 * Math.PI * 900 * (t - at)) * Math.exp(-(t - at) * 160) * 0.25 : 0),
			0,
		);
		return (0.8 * bloop + burst + drip) * fadeOut(t, duration, 0.02);
	});
}

/**
 * The door: a wooden creak (stick-slip pulses whose rate wanders around 150 Hz, through a resonant
 * body) for 0.62 s, then a stone thud: a low 55 Hz knock with dull noise.
 */
function doorOpen(): Float32Array {
	const noise = seededNoise(0xd0025);
	const creakEnd = 0.62;
	let phase = 0;
	let body = 0;
	let bodySpeed = 0;
	let dull = 0;
	return render(0.95, (t, duration) => {
		const wander = Math.sin(2 * Math.PI * 1.7 * t) + 0.5 * Math.sin(2 * Math.PI * 4.3 * t + 1);
		phase += (150 + 45 * wander) / SAMPLE_RATE;
		// Each slip is a short pulse; the wood body rings at about 700 Hz (a two-pole resonator).
		const slip = phase % 1 < 0.08 ? 1 : 0;
		const swell = Math.sin(Math.PI * Math.min(t / creakEnd, 1)) ** 0.6;
		const drive = t < creakEnd ? slip * (0.6 + 0.4 * Math.abs(noise())) * swell : 0;
		const w = (2 * Math.PI * 700) / SAMPLE_RATE;
		bodySpeed += drive * 0.3 - w * w * body - 0.04 * bodySpeed;
		body += bodySpeed;
		const since = t - creakEnd;
		dull += 0.05 * (noise() - dull);
		const thud =
			since < 0
				? 0
				: (Math.sin(2 * Math.PI * 55 * since) + 0.5 * Math.sin(2 * Math.PI * 82 * since)) *
						Math.exp(-since * 14) *
						attack(since, 0.004) +
					3 * dull * Math.exp(-since * 30);
		return 0.5 * body + thud * 1.4 * fadeOut(t, duration, 0.04);
	});
}
