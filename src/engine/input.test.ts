// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createKeyboardInput, type InputSnapshot, isTextEntry, type KeyboardInput } from "./input";

let keyboard: KeyboardInput | undefined;

beforeEach(() => {
	document.body.innerHTML = `
		<canvas tabindex="0"></canvas>
		<div class="overlay"><article tabindex="-1"><p>Long text</p></article></div>`;
});

afterEach(() => {
	keyboard?.dispose();
	keyboard = undefined;
});

function press(target: EventTarget, code: string): KeyboardEvent {
	const event = new KeyboardEvent("keydown", { code, bubbles: true, cancelable: true });
	target.dispatchEvent(event);
	return event;
}

function element(selector: string): HTMLElement {
	const found = document.querySelector<HTMLElement>(selector);
	if (!found) throw new Error(`No ${selector}.`);
	return found;
}

const empty = (): InputSnapshot => ({ forward: 0, strafe: 0, turn: 0, look: 0, shoot: false, use: false });

describe("Keyboard input", () => {
	it("writes the keys that are down into the caller's snapshot, and the use key once per press", () => {
		keyboard = createKeyboardInput(window);
		const input = empty();
		input.look = 12;
		input.shoot = true;

		press(element("canvas"), "KeyW");
		press(element("canvas"), "KeyD");
		press(element("canvas"), "KeyE");
		keyboard.snapshot(input);

		expect(input).toEqual({ forward: 1, strafe: 1, turn: 0, look: 12, shoot: true, use: true });
		keyboard.snapshot(input);
		expect(input.use).toBe(false);
	});

	it("keeps the arrow keys from scrolling the page while the game has the keys", () => {
		keyboard = createKeyboardInput(window);
		expect(press(element("canvas"), "ArrowDown").defaultPrevented).toBe(true);
	});

	it("leaves keys pressed in an element that belongs to the page to the browser, so arrow keys scroll it", () => {
		keyboard = createKeyboardInput(window, {
			belongsToPage: (target) => target instanceof Element && target.closest(".overlay") !== null,
		});
		const input = empty();

		const event = press(element(".overlay article"), "ArrowDown");
		keyboard.snapshot(input);

		expect(event.defaultPrevented).toBe(false);
		expect(input.forward).toBe(0);
	});
});

describe("isTextEntry", () => {
	it("is true for controls that take typed text, and false for checkboxes, sliders, and other elements", () => {
		document.body.innerHTML = `
			<input id="text" type="text"><input id="search" type="search"><input id="plain">
			<textarea id="area"></textarea>
			<input id="box" type="checkbox"><input id="range" type="range"><button id="button">B</button>`;
		const entries = ["text", "search", "plain", "area"].map((id) => isTextEntry(element(`#${id}`)));
		const others = ["box", "range", "button"].map((id) => isTextEntry(element(`#${id}`)));

		expect(entries).toEqual([true, true, true, true]);
		expect(others).toEqual([false, false, false]);
		expect(isTextEntry(null)).toBe(false);
	});
});
