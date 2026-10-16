/**
 * The input for one fixed tick.
 * forward, strafe, and turn are key axes in [-1, 1]: +1 moves forward, moves right, turns right.
 * look is the mouse movement to the right since the last tick, in screen pixels (not clamped).
 * use is true when the player pressed use (E) since the last tick, or still holds it.
 */
export interface InputSnapshot {
	forward: number;
	strafe: number;
	turn: number;
	look: number;
	use: boolean;
}

type Axis = "forward" | "strafe" | "turn";

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
const USE_KEY = "KeyE";

export interface KeyboardInput {
	/** The input for the next tick, from the keys that are down now. */
	snapshot(): InputSnapshot;
	/** Removes the event listeners. */
	dispose(): void;
}

/** Tracks the keys that are down and turns them into one input snapshot per tick. */
export function createKeyboardInput(target: Window): KeyboardInput {
	const down = new Set<string>();
	// A tap shorter than one tick still counts as one use.
	let usePressed = false;

	const onKeyDown = (event: KeyboardEvent) => {
		if (isFormControl(event.target)) return;
		if (event.code === USE_KEY) {
			usePressed = true;
			down.add(event.code);
			return;
		}
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
			const input: InputSnapshot = { forward: 0, strafe: 0, turn: 0, look: 0, use: usePressed || down.has(USE_KEY) };
			usePressed = false;
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

/** Keys typed into a form control (for example a slider in an overlay) are for that control, not the game. */
function isFormControl(target: EventTarget | null): boolean {
	return target instanceof Element && target.closest("input, select, textarea") !== null;
}
