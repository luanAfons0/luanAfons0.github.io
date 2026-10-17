/**
 * Helpers to synthesize sounds sample by sample, at `SAMPLE_RATE`. They use no randomness of their
 * own: noise comes from `seededNoise`, so every run gives the same samples.
 */
import { SAMPLE_RATE } from "./files.ts";

/** The samples of `seconds` of sound; `sample` gets the time of each sample and the length. */
export function render(seconds: number, sample: (t: number, duration: number) => number): Float32Array {
	const samples = new Float32Array(Math.round(seconds * SAMPLE_RATE));
	for (let i = 0; i < samples.length; i++) samples[i] = sample(i / SAMPLE_RATE, seconds);
	return samples;
}

/** Scales the samples so the loudest one is `peak`. */
export function normalize(samples: Float32Array, peak: number): Float32Array {
	const loudest = samples.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
	return loudest === 0 ? samples : samples.map((value) => (value / loudest) * peak);
}

/** 0 at the start, 1 after `length` seconds: a short fade-in, so the sound starts with no click. */
export function attack(t: number, length: number): number {
	return Math.min(t / length, 1);
}

/** 1 until `length` seconds before `end`, then down to 0 at `end`. */
export function fadeOut(t: number, end: number, length: number): number {
	return Math.max(0, Math.min((end - t) / length, 1));
}

export function smoothstep(x: number): number {
	return x * x * (3 - 2 * x);
}

/** White noise from -1 to 1, from a mulberry32 generator with a fixed seed. */
export function seededNoise(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
	};
}
