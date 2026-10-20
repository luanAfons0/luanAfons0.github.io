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

/** Expects every "Add to project" button of a Package (the Twin copy too) to read as `want`: label, icon, pressed. */
function expectAddButtons(key: string, want: { label: string; icon: string; pressed: string }): void {
	const buttons = all(`[data-add="${key}"]`).map((b) => ({
		label: b.querySelector("span")?.textContent,
		icon: b.querySelector("use")?.getAttribute("href"),
		pressed: b.getAttribute("aria-pressed"),
	}));
	expect(buttons.length).toBeGreaterThan(0);
	for (const button of buttons) expect(button).toEqual(want);
}

/** Intl puts a no-break space between "R$" and the amount. */
const NBSP = " ";
const IN_PROJECT = { label: "In your project", icon: "#i-check", pressed: "true" };
const NOT_IN_PROJECT = { label: "Add to project", icon: "#i-plus", pressed: "false" };

const pick = (key: string) => one<HTMLInputElement>(`#picks [data-pick="${key}"]`);
const toggle = (key: string) => pick(key).click();
const addButton = (key: string) => one<HTMLButtonElement>(`[data-add="${key}"]`);

/** The Project estimate, as a visitor reads it: the strip units, the numbered lines, and the announced total. */
function estimate() {
	return {
		strip: all("#strip > span").map((s) => `${s.className}:${s.textContent}`),
		lines: all("#r-lines li").map((li) => li.textContent),
		total: one("#r-total").getAttribute("aria-label"),
	};
}

beforeEach(() => {
	loadHomeBody();
	localStorage.clear();
});

afterEach(() => {
	for (const home of homes) home.dispose();
	homes = [];
	vi.restoreAllMocks();
});

describe("the first render", () => {
	it("starts with Store launch and Speed audit in the project, and the date of today", () => {
		vi.useFakeTimers({ now: new Date(2026, 9, 20, 12), toFake: ["Date"] });
		mount();
		vi.useRealTimers();

		expect(estimate()).toEqual({
			strip: ["seg:1", "seg free:2"],
			lines: ["1Store launch$900", "2Speed auditfree"],
			total: "$900",
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
		expectAddButtons("launch", IN_PROJECT);
		expectAddButtons("fix", NOT_IN_PROJECT);
		expect(one("#r-date").textContent).toBe("Oct 20, 2026");
	});
});

describe("the Add to project buttons and the builder switches", () => {
	it("puts a Package in the project from the table, and the switch follows", () => {
		mount();

		addButton("fix").click();

		expectAddButtons("fix", IN_PROJECT);
		expect(pick("fix").checked).toBe(true);
		expect(estimate().lines).toEqual(["1Store launch$900", "2Store fix$160", "3Speed auditfree"]);
	});

	it("takes a Package out of the project from the table, and the switch follows", () => {
		mount();

		addButton("launch").click();

		expectAddButtons("launch", NOT_IN_PROJECT);
		expect(pick("launch").checked).toBe(false);
		expect(estimate().total).toBe("$0");
	});

	it("syncs every button of the Package when the last one is clicked (the Twin copy, once it exists)", () => {
		mount();

		all<HTMLButtonElement>('[data-add="care"]').at(-1)?.click();

		expectAddButtons("care", IN_PROJECT);
		expect(pick("care").checked).toBe(true);
	});

	it("adds a switched-on service to the strip, the lines and the total, and the table button follows", () => {
		mount();

		toggle("fix");

		expect(estimate()).toEqual({
			strip: ["seg:1", "seg is-new:2", "seg free:3"],
			lines: ["1Store launch$900", "2Store fix$160", "3Speed auditfree"],
			total: "$1,060",
		});
		expectAddButtons("fix", IN_PROJECT);

		toggle("launch");

		expect(estimate()).toEqual({
			strip: ["seg:1", "seg free:2"],
			lines: ["1Store fix$160", "2Speed auditfree"],
			total: "$160",
		});
		expectAddButtons("launch", NOT_IN_PROJECT);
	});
});

describe("the strip", () => {
	it("marks only the new unit as new, and gives each unit its price as its size", () => {
		mount();

		toggle("fix");

		expect(all("#strip > span").map((s) => [s.textContent, s.className, s.style.getPropertyValue("--g")])).toEqual([
			["1", "seg", "900"],
			["2", "seg is-new", "160"],
			["3", "seg free", "60"],
		]);
	});
});

describe("the totals in both currencies", () => {
	it("shows the lines and the total in BRL in Portuguese, and in USD again in English", () => {
		mount();
		toggle("section");

		langButton("pt").click();

		expect(estimate()).toEqual({
			strip: ["seg:1", "seg free:2", "seg:3"],
			lines: [`1Loja novaR$${NBSP}4.500`, "2Auditoria de velocidadegrátis", `3Seção personalizadaR$${NBSP}900`],
			total: `R$${NBSP}5.400`,
		});
		expect(pick("launch").closest("label")?.querySelector(".pick-price")?.textContent).toBe(`+R$${NBSP}4.500`);
		expect(pick("audit").closest("label")?.querySelector(".pick-price")?.textContent).toBe("Grátis");
		expect(pick("section").checked).toBe(true);
		expectAddButtons("launch", { label: "No seu projeto", icon: "#i-check", pressed: "true" });
		expectAddButtons("fix", { label: "Pôr no projeto", icon: "#i-plus", pressed: "false" });

		langButton("en").click();

		expect(estimate().total).toBe("$1,080");
		expect(estimate().lines.at(-1)).toBe("3Custom section$180");
	});
});

describe("the empty state", () => {
	it("shows the empty strip and the empty line when nothing is on, and a zero total", () => {
		mount();

		toggle("launch");
		toggle("audit");

		expect(estimate()).toEqual({
			strip: ["strip-empty:"],
			lines: ["Nothing in the project yet. Switch on a service to see the total."],
			total: "$0",
		});
		expect(one("#r-lines li").className).toBe("lines-empty");

		langButton("pt").click();

		expect(estimate().lines).toEqual(["Ainda não há nada no projeto. Ligue um serviço para ver o total."]);
		expect(estimate().total).toBe(`R$${NBSP}0`);
	});
});

describe("the odometer", () => {
	let frames: FrameRequestCallback[] = [];
	beforeEach(() => {
		frames = [];
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => frames.push(cb));
	});
	/** Runs the frames that wait now. */
	const nextFrame = () => {
		for (const cb of frames.splice(0)) cb(0);
	};
	const columns = () => all("#r-total .roll-col").map((col) => col.style.getPropertyValue("--v"));

	it("rolls from the last total to the new one, and announces the new total", () => {
		mount();
		expect(columns()).toEqual(["9", "0", "0"]);

		addButton("fix").click();

		expect(one("#r-total").getAttribute("aria-label")).toBe("$1,060");
		expect(one("#r-total").getAttribute("role")).toBe("status");
		// New columns start from the old digits, right-aligned.
		expect(columns()).toEqual(["0", "9", "0", "0"]);
		nextFrame();
		nextFrame();
		expect(columns()).toEqual(["1", "0", "6", "0"]);

		addButton("care").click();

		// Same shape: the columns roll at once.
		expect(columns()).toEqual(["1", "1", "8", "0"]);
		expect(one("#r-total").getAttribute("aria-label")).toBe("$1,180");
	});

	it("ends on the last total when two changes come before the roll starts", () => {
		mount();

		// A new shape waits two frames to roll; the second change has the same shape and fills at once.
		addButton("fix").click();
		addButton("care").click();
		// The roll still starts from the old digits.
		expect(columns()).toEqual(["0", "9", "0", "0"]);
		nextFrame();
		nextFrame();

		expect(columns()).toEqual(["1", "1", "8", "0"]);
		expect(one("#r-total").getAttribute("aria-label")).toBe("$1,180");
	});

	it("ends on the last total when two new shapes come before the roll starts", () => {
		mount();

		addButton("fix").click();
		addButton("fix").click();
		nextFrame();
		nextFrame();

		expect(columns()).toEqual(["9", "0", "0"]);
		expect(one("#r-total").getAttribute("aria-label")).toBe("$900");
	});
});

describe("the add event", () => {
	let count: ReturnType<typeof vi.fn<(vars?: GoatCounterVars) => void>>;
	beforeEach(() => {
		count = vi.fn<(vars?: GoatCounterVars) => void>();
		window.goatcounter = { count };
	});
	afterEach(() => {
		delete window.goatcounter;
	});
	const events = () => count.mock.calls.map(([vars]) => vars?.path);

	it("sends add/<package> when a table button puts a Package in the project, not when it takes it out", () => {
		mount();

		addButton("fix").click();
		addButton("care").click();
		addButton("fix").click();
		addButton("launch").click();
		addButton("launch").click();

		expect(events()).toEqual(["add/fix", "add/care", "add/launch"]);
	});

	it("sends nothing for the builder switches", () => {
		mount();

		toggle("fix");
		toggle("import");

		expect(events()).toEqual([]);
	});
});
