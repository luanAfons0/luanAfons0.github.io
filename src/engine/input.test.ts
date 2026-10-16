// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createKeyboardInput, isTextEntry, type KeyboardInput } from "./input";

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

describe("Keyboard input", () => {
	it("keeps the arrow keys from scrolling the page while the game has the keys", () => {
		keyboard = createKeyboardInput(window);
		expect(press(element("canvas"), "ArrowDown").defaultPrevented).toBe(true);
	});

	it("leaves keys pressed in an element that belongs to the page to the browser, so arrow keys scroll it", () => {
		keyboard = createKeyboardInput(window, {
			belongsToPage: (target) => target instanceof Element && target.closest(".overlay") !== null,
		});
		const event = press(element(".overlay article"), "ArrowDown");

		expect(event.defaultPrevented).toBe(false);
		expect(keyboard.snapshot().forward).toBe(0);
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
