/**
 * The input for one fixed tick.
 * forward, strafe, and turn are key axes in [-1, 1]: +1 moves forward, moves right, turns right.
 * look is the mouse movement to the right since the last tick, in screen pixels (not clamped).
 * lookUp is the mouse movement up since the last tick, in screen pixels (not clamped). Default 0.
 * shoot is true in the one tick after the player pressed the fire button.
 * use is true on the one tick after the player presses the use key (not while the key is held).
 */
export interface InputSnapshot {
	forward: number;
	strafe: number;
	turn: number;
	look: number;
	lookUp?: number;
	shoot?: boolean;
	use?: boolean;
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

/** The key that uses what the player looks at. It counts once per press, not while it is held. */
const USE_KEY = "KeyE";

export interface KeyboardInputOptions {
	/**
	 * True for a key event target whose keys go to the page, not the game (for example a scrollable
	 * overlay): the game ignores those keys and lets the browser handle them. Default: none.
	 */
	belongsToPage?(target: EventTarget | null): boolean;
}

export interface KeyboardInput {
	/**
	 * Writes the input for the next tick into `input`: the axes of the keys that are down now, and
	 * the use key pressed since the last call. It leaves `look`, `lookUp`, and `shoot` alone (the mouse owns
	 * them) and allocates nothing.
	 */
	snapshot(input: InputSnapshot): void;
	/** Removes the event listeners. */
	dispose(): void;
}

/** Tracks the keys that are down and turns them into one input snapshot per tick. */
export function createKeyboardInput(target: Window, options: KeyboardInputOptions = {}): KeyboardInput {
	const down = new Set<string>();
	let usePressed = false;

	const onKeyDown = (event: KeyboardEvent) => {
		if (isFormControl(event.target) || options.belongsToPage?.(event.target)) return;
		if (event.code === USE_KEY) {
			if (!event.repeat) usePressed = true;
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
	const onBlur = () => {
		down.clear();
		usePressed = false;
	};

	target.addEventListener("keydown", onKeyDown);
	target.addEventListener("keyup", onKeyUp);
	target.addEventListener("blur", onBlur);

	return {
		snapshot(input) {
			input.forward = 0;
			input.strafe = 0;
			input.turn = 0;
			input.use = usePressed;
			usePressed = false;
			for (const code of down) {
				const binding = KEY_BINDINGS[code];
				if (binding) input[binding[0]] += binding[1];
			}
		},
		dispose() {
			target.removeEventListener("keydown", onKeyDown);
			target.removeEventListener("keyup", onKeyUp);
			target.removeEventListener("blur", onBlur);
		},
	};
}

/** Keys typed into a form control (for example a slider in an overlay) are for that control, not the game. */
export function isFormControl(target: EventTarget | null): boolean {
	return target instanceof Element && target.closest("input, select, textarea") !== null;
}

/** The input types that take typed text. Keys typed into them are for the text, not for shortcuts. */
const TEXT_INPUT_TYPES = new Set(["text", "search", "email", "url", "tel", "password", "number"]);

/**
 * True when keys typed at `target` enter text: a textarea, a text-like input, or editable content.
 * A checkbox or a slider is a form control, but it takes no text, so a shortcut key still works there.
 */
export function isTextEntry(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	if (target instanceof HTMLTextAreaElement || target.isContentEditable) return true;
	return target instanceof HTMLInputElement && TEXT_INPUT_TYPES.has(target.type);
}
