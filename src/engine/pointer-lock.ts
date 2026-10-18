/** Chrome sometimes sends one huge mouse delta when the lock starts. Larger moves are dropped. */
const MAX_DELTA_PX = 500;

export interface MouseLook {
	/** The mouse movement to the right since the last call, in pixels. 0 while the mouse is not captured. */
	takeLook(): number;
	/** The mouse movement up since the last call, in pixels. 0 while the mouse is not captured. */
	takeLookUp(): number;
	/**
	 * True when the player pressed the left button since the last call, while the mouse was captured.
	 * The click that captures the mouse does not count.
	 */
	takeShot(): boolean;
	isLocked(): boolean;
	/** Asks the browser to capture the mouse. Call it from a click or key handler (a user gesture). */
	lock(): void;
	unlock(): void;
	/** Removes the event listeners. */
	dispose(): void;
}

/**
 * Captures the mouse with Pointer Lock and collects its movement for mouse look.
 * `onLockChange` runs each time the lock starts or stops. The browser also stops
 * the lock by itself when the player presses Esc.
 */
export function createMouseLook(element: HTMLElement, onLockChange: (locked: boolean) => void): MouseLook {
	let look = 0;
	let lookUp = 0;
	let shot = false;
	let skipNext = false;
	const isLocked = () => document.pointerLockElement === element;

	const onMouseMove = (event: MouseEvent) => {
		if (!isLocked()) return;
		if (skipNext || Math.abs(event.movementX) > MAX_DELTA_PX || Math.abs(event.movementY) > MAX_DELTA_PX) {
			skipNext = false;
			return;
		}
		look += event.movementX;
		lookUp -= event.movementY; // movementY grows downward.
	};
	// The capturing click presses the button before the lock starts, so it never shoots.
	const onMouseDown = (event: MouseEvent) => {
		if (isLocked() && event.button === 0) shot = true;
	};
	const onChange = () => {
		look = 0;
		lookUp = 0;
		shot = false;
		skipNext = isLocked();
		onLockChange(isLocked());
	};

	document.addEventListener("mousemove", onMouseMove);
	document.addEventListener("mousedown", onMouseDown);
	document.addEventListener("pointerlockchange", onChange);

	return {
		takeLook() {
			const value = look;
			look = 0;
			return value;
		},
		takeLookUp() {
			const value = lookUp;
			lookUp = 0;
			return value;
		},
		takeShot() {
			const value = shot;
			shot = false;
			return value;
		},
		isLocked,
		lock() {
			if (isLocked()) return;
			// Raw mouse input (no OS acceleration) where the browser supports it; else a plain lock.
			// A refused lock (for example, right after Esc) is not an error: the next click tries again.
			request({ unadjustedMovement: true }).catch((error: unknown) => {
				if (error instanceof DOMException && error.name === "NotSupportedError") request().catch(() => {});
			});
		},
		unlock() {
			if (isLocked()) document.exitPointerLock();
		},
		dispose() {
			document.removeEventListener("mousemove", onMouseMove);
			document.removeEventListener("mousedown", onMouseDown);
			document.removeEventListener("pointerlockchange", onChange);
		},
	};

	/** Some browsers return a Promise, some return nothing, and some throw. */
	function request(options?: PointerLockOptions): Promise<void> {
		try {
			return Promise.resolve(element.requestPointerLock(options));
		} catch (error) {
			return Promise.reject(error);
		}
	}
}
