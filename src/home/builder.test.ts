// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Home, mountHome } from "./home";
import { loadHomeBody } from "./test-support/page";

let homes: Home[] = [];

function mount(): Home {
	const home = mountHome(document);
	homes.push(home);
	return home;
}

function one<E extends Element = HTMLElement>(selector: string): E {
	const el = document.querySelector<E>(selector);
	if (!el) throw new Error(`no ${selector}`);
	return el;
}

function all<E extends Element = HTMLElement>(selector: string): E[] {
	return [...document.querySelectorAll<E>(selector)];
}

function langButton(id: "en" | "pt"): HTMLButtonElement {
	return one<HTMLButtonElement>(`.lang button[data-lang="${id}"]`);
}

const pick = (key: string) => one<HTMLInputElement>(`#picks [data-pick="${key}"]`);
const toggle = (key: string) => pick(key).click();
const message = () => one<HTMLTextAreaElement>("#f-msg");
/** The Book a call link of the Project list in the first copy. */
const bookFromProject = () => one<HTMLAnchorElement>("[data-prefill]");

/** The Project list, as a visitor reads it: the strip units, the numbered lines, and whether the note shows. */
function project() {
	return {
		strip: all("#strip > span").map((s) => `${s.className}:${s.textContent}`),
		lines: all("#r-lines li").map((li) => li.textContent),
		note: !one(".est-note").hidden,
	};
}

beforeEach(() => {
	loadHomeBody();
	localStorage.clear();
});

afterEach(() => {
	for (const home of homes) home.dispose();
	homes = [];
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("the first render", () => {
	it("starts with Store launch and Speed audit in the project, and the date of today", () => {
		vi.useFakeTimers({ now: new Date(2026, 9, 20, 12), toFake: ["Date"] });
		mount();
		vi.useRealTimers();

		expect(project()).toEqual({
			strip: ["seg:1", "seg:2"],
			lines: ["1Store launch", "2Speed audit"],
			note: true,
		});
		expect(all<HTMLInputElement>("#picks [data-pick]").map((i) => [i.dataset.pick, i.checked])).toEqual([
			["launch", true],
			["fix", false],
			["care", false],
			["audit", true],
			["import", false],
			["section", false],
			["lang2", false],
		]);
		expect(one("#r-date").textContent).toBe("Oct 20, 2026");
	});

	it("shows no price in the switches or in the Project list", () => {
		mount();

		expect(all(".pick-price")).toEqual([]);
		expect(one("#builder").textContent).not.toMatch(/\$|R\$|free|total/i);
	});
});

describe("the builder switches", () => {
	it("adds a switched-on service to the strip and the lines as one equal unit, and takes it out again", () => {
		mount();

		toggle("fix");

		expect(project()).toEqual({
			strip: ["seg:1", "seg is-new:2", "seg:3"],
			lines: ["1Store launch", "2Store fix", "3Speed audit"],
			note: true,
		});
		expect(all("#r-lines li").map((li) => li.className)).toEqual(["line", "line is-new", "line"]);
		expect(all<HTMLElement>("#strip > span").map((s) => s.getAttribute("style"))).toEqual([null, null, null]);

		toggle("launch");

		expect(project()).toEqual({
			strip: ["seg:1", "seg:2"],
			lines: ["1Store fix", "2Speed audit"],
			note: true,
		});
	});

	it("marks nothing as new with reduced motion", () => {
		vi.spyOn(window, "matchMedia").mockImplementation(
			(media) => ({ media, matches: media.includes("reduce"), addEventListener() {} }) as unknown as MediaQueryList,
		);
		mount();

		toggle("fix");

		expect(project().strip).toEqual(["seg:1", "seg:2", "seg:3"]);
	});

	it("shows the switches and the lines in Portuguese, and in English again", () => {
		mount();
		toggle("section");

		langButton("pt").click();

		expect(project().lines).toEqual(["1Loja nova", "2Auditoria de velocidade", "3Seção personalizada"]);
		expect(pick("section").checked).toBe(true);
		expect(pick("launch").closest("label")?.querySelector(".pick-name")?.textContent).toBe("Loja nova");

		langButton("en").click();

		expect(project().lines.at(-1)).toBe("3Custom section");
	});
});

describe("the empty state", () => {
	it("shows the empty strip and the empty line, and hides the note, when nothing is on", () => {
		mount();

		toggle("launch");
		toggle("audit");

		expect(project()).toEqual({
			strip: ["strip-empty:"],
			lines: ["Nothing here yet. Switch on a service to add it."],
			note: false,
		});
		expect(one("#r-lines li").className).toBe("lines-empty");

		langButton("pt").click();

		expect(project().lines).toEqual(["Ainda não há nada aqui. Ligue um serviço para adicionar."]);
	});
});

describe("Book a call from the Project list", () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
	});

	it("puts the list in the message, then an empty line, and puts the cursor at the end", () => {
		mount();

		bookFromProject().click();

		expect(message().value).toBe("I am interested in:\n- Store launch\n- Speed audit\n\n");
		expect(message().classList.contains("is-filled")).toBe(true);
		vi.runAllTimers();
		expect(document.activeElement).toBe(message());
		expect(message().selectionStart).toBe(message().value.length);
		expect(message().selectionEnd).toBe(message().value.length);
	});

	it("replaces the list that it put there before, and keeps the text that the visitor wrote after it", () => {
		mount();
		bookFromProject().click();
		message().value += "My store sells coffee.";

		toggle("fix");
		toggle("launch");
		bookFromProject().click();

		expect(message().value).toBe("I am interested in:\n- Store fix\n- Speed audit\n\nMy store sells coffee.");
	});

	it("puts the list before text that the visitor wrote first", () => {
		mount();
		message().value = "Hi, I need help.";

		bookFromProject().click();

		expect(message().value).toBe("I am interested in:\n- Store launch\n- Speed audit\n\nHi, I need help.");
	});

	it("takes its old list out when the project is empty, and still moves the focus to the message", () => {
		mount();
		bookFromProject().click();
		toggle("launch");
		toggle("audit");

		bookFromProject().click();

		expect(message().value).toBe("");
		expect(message().classList.contains("is-filled")).toBe(false);
		vi.runAllTimers();
		expect(document.activeElement).toBe(message());
	});

	it("writes the list in the language of the page", () => {
		mount();
		langButton("pt").click();

		bookFromProject().click();

		expect(message().value).toBe("Tenho interesse em:\n- Loja nova\n- Auditoria de velocidade\n\n");
	});

	it("fills the message of the first copy from the link of the Twin copy too", () => {
		mount();

		all<HTMLAnchorElement>("[data-prefill]").at(-1)?.click();

		expect(all("[data-prefill]").length).toBe(2);
		expect(message().value).toBe("I am interested in:\n- Store launch\n- Speed audit\n\n");
	});

	it("does not move the focus after dispose()", () => {
		const home = mount();
		bookFromProject().click();

		home.dispose();
		vi.runAllTimers();

		expect(document.activeElement).not.toBe(message());
	});
});

describe("the analytics events", () => {
	let count: ReturnType<typeof vi.fn<(vars?: GoatCounterVars) => void>>;
	beforeEach(() => {
		count = vi.fn<(vars?: GoatCounterVars) => void>();
		window.goatcounter = { count };
	});
	afterEach(() => {
		delete window.goatcounter;
	});
	const events = () => count.mock.calls.map(([vars]) => vars?.path);

	it("sends nothing for the builder switches", () => {
		mount();

		toggle("fix");
		toggle("import");

		expect(events()).toEqual([]);
	});

	it("sends book-call for the Book a call link of the Project list", () => {
		mount();

		bookFromProject().click();

		expect(events()).toEqual(["book-call"]);
	});
});
