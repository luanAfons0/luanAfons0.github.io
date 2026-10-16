export interface FixedStepLoopOptions {
	ticksPerSecond: number;
	/**
	 * The longest frame time the loop accepts, in ms. A longer frame (for example
	 * after the tab was hidden) is cut to this, so the game does not run many ticks at once.
	 */
	maxFrameMs?: number;
}

export interface FixedStepLoop {
	/**
	 * Adds `elapsedMs` of real time and calls `tick` once for each full fixed step
	 * that is now due. Returns the number of ticks it ran. It never reads a clock,
	 * so callers (and tests) decide how much time passes.
	 */
	advance(elapsedMs: number, tick: () => void): number;
}

/** Floating-point slack, so 60 frames of 1000/60 ms give exactly 60 ticks. */
const EPSILON_MS = 1e-6;

export function createFixedStepLoop(options: FixedStepLoopOptions): FixedStepLoop {
	const stepMs = 1000 / options.ticksPerSecond;
	const maxFrameMs = options.maxFrameMs ?? 250;
	let accumulator = 0;

	return {
		advance(elapsedMs, tick) {
			accumulator += Math.min(Math.max(elapsedMs, 0), maxFrameMs);
			let ticks = 0;
			while (accumulator + EPSILON_MS >= stepMs) {
				accumulator -= stepMs;
				tick();
				ticks++;
			}
			if (accumulator < 0) accumulator = 0;
			return ticks;
		},
	};
}
