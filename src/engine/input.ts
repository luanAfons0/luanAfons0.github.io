/**
 * The input for one fixed tick. Every axis is in [-1, 1].
 * forward: +1 moves forward. strafe: +1 moves right. turn: +1 turns right.
 */
export interface InputSnapshot {
	forward: number;
	strafe: number;
	turn: number;
}

type Axis = keyof InputSnapshot;

/** Which axis each key drives, and in which direction. Keys are `KeyboardEvent.code` values. */
const KEY_BINDINGS: Record<string, [Axis, number]> = {
	KeyW: ["forward", 1],
	KeyS: ["forward", -1],
	KeyA: ["strafe", -1],
	KeyD: ["strafe", 1],
	ArrowUp: ["forward", 1],
	ArrowDown: ["forward", -1],
	ArrowLeft: ["turn", -1],
	ArrowRight: ["turn", 1],
};

export interface KeyboardInput {
	/** The input for the next tick, from the keys that are down now. */
	snapshot(): InputSnapshot;
	/** Removes the event listeners. */
	dispose(): void;
}

/** Tracks the keys that are down and turns them into one input snapshot per tick. */
export function createKeyboardInput(target: Window): KeyboardInput {
	const down = new Set<string>();

	const onKeyDown = (event: KeyboardEvent) => {
		if (!(event.code in KEY_BINDINGS)) return;
		event.preventDefault(); // Arrow keys would scroll the page.
		down.add(event.code);
	};
	const onKeyUp = (event: KeyboardEvent) => {
		down.delete(event.code);
	};
	// A key released while the window has no focus never sends keyup.
	const onBlur = () => down.clear();

	target.addEventListener("keydown", onKeyDown);
	target.addEventListener("keyup", onKeyUp);
	target.addEventListener("blur", onBlur);

	return {
		snapshot() {
			const input: InputSnapshot = { forward: 0, strafe: 0, turn: 0 };
			for (const code of down) {
				const binding = KEY_BINDINGS[code];
				if (binding) input[binding[0]] += binding[1];
			}
			return input;
		},
		dispose() {
			target.removeEventListener("keydown", onKeyDown);
			target.removeEventListener("keyup", onKeyUp);
			target.removeEventListener("blur", onBlur);
		},
	};
}
