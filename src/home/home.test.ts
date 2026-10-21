// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type CopyKey, T } from "./copy";
import { type Home, mountHome } from "./home";
import { loadHomeBody } from "./test-support/page";

let homes: Home[] = [];

function mount(): Home {
	const home = mountHome(document);
	homes.push(home);
	return home;
}

function all<E extends Element = HTMLElement>(selector: string): E[] {
	return [...document.querySelectorAll<E>(selector)];
}

/** The elements outside the Twin copy: the page as assistive technology reads it. */
function outsideTwin<E extends Element = HTMLElement>(selector: string): E[] {
	return all<E>(selector).filter((el) => !el.closest('.vs-copy[aria-hidden="true"]'));
}

function langButton(id: "en" | "pt"): HTMLButtonElement {
	const button = document.querySelector<HTMLButtonElement>(`.lang button[data-lang="${id}"]`);
	if (!button) throw new Error(`no ${id} button`);
	return button;
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

describe("the Home page mount", () => {
	it("marks the root as scripted and starts in English", () => {
		mount();

		expect(document.documentElement.classList.contains("js")).toBe(true);
		expect(document.documentElement.lang).toBe("en");
		expect(document.querySelector("h1")?.textContent).toBe("Shopify stores, built to sell");
		expect(langButton("en").getAttribute("aria-pressed")).toBe("true");
		expect(langButton("pt").getAttribute("aria-pressed")).toBe("false");
	});
});

describe("the language switch", () => {
	it("puts the page in Portuguese with BRL Demo store prices, then back in English with USD prices", () => {
		mount();

		langButton("pt").click();

		expect(document.documentElement.lang).toBe("pt-BR");
		expect(document.querySelector("h1")?.textContent).toBe("Lojas Shopify feitas para vender");
		expect(langButton("pt").getAttribute("aria-pressed")).toBe("true");
		expect(langButton("en").getAttribute("aria-pressed")).toBe("false");
		expect(document.querySelector("#services")?.getAttribute("aria-label")).toBe("O que eu faço");
		expect(document.querySelector("#f-url")?.getAttribute("placeholder")).toBe("https://sualoja.com.br");
		expect(document.querySelector('a[href="#builder"]')?.textContent).toBe("Seu projeto");
		expect(document.querySelector("#est-title")?.textContent).toBe("Seu projeto");
		expect(document.querySelector('[data-demo-price="coffee"]')?.textContent).toBe("R$ 54,90");

		langButton("en").click();

		expect(document.documentElement.lang).toBe("en");
		expect(document.querySelector("h1")?.textContent).toBe("Shopify stores, built to sell");
		expect(document.querySelector('a[href="#builder"]')?.textContent).toBe("Your project");
		expect(document.querySelector("#est-title")?.textContent).toBe("Your project");
		expect(document.querySelector('[data-demo-price="coffee"]')?.textContent).toBe("$12");
	});
});

describe("the saved language", () => {
	it("saves the choice and restores it on the next visit", () => {
		mount();
		langButton("pt").click();
		expect(localStorage.getItem("la.lang")).toBe("pt");

		homes.pop()?.dispose();
		loadHomeBody();
		mount();

		expect(document.documentElement.lang).toBe("pt-BR");
		expect(langButton("pt").getAttribute("aria-pressed")).toBe("true");
		expect(document.querySelector("h1")?.textContent).toBe("Lojas Shopify feitas para vender");
	});

	it("ignores a saved value that is not a language", () => {
		localStorage.setItem("la.lang", "fr");
		mount();

		expect(document.documentElement.lang).toBe("en");
	});

	it("starts in English and still switches when the storage throws", () => {
		vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
			throw new DOMException("blocked", "SecurityError");
		});
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw new DOMException("full", "QuotaExceededError");
		});

		expect(() => mount()).not.toThrow();
		expect(document.documentElement.lang).toBe("en");

		expect(() => langButton("pt").click()).not.toThrow();
		expect(document.documentElement.lang).toBe("pt-BR");
		expect(document.querySelector("h1")?.textContent).toBe("Lojas Shopify feitas para vender");
	});
});

describe("the translated page", () => {
	const KEYS = Object.keys(T.en);

	for (const lang of ["en", "pt"] as const) {
		it(`shows the ${lang.toUpperCase()} dictionary text in every translated element, with no raw key`, () => {
			mount();
			langButton(lang).click();

			const texts = all("[data-t]");
			const labels = all("[data-t-aria]");
			const placeholders = all("[data-t-ph]");
			const links = all("[data-t-href]");
			expect(texts.length).toBeGreaterThan(100);
			expect(labels.length).toBeGreaterThan(0);
			expect(placeholders.length).toBeGreaterThan(0);
			expect(links.length).toBeGreaterThan(0);

			for (const el of texts) {
				const key = el.dataset.t as CopyKey;
				expect(KEYS, "a key of the dictionary").toContain(key);
				expect(el.textContent, key).toBe(T[lang][key].replace("{key}", T[lang]["pr.key"]));
			}
			for (const el of labels) expect(el.getAttribute("aria-label")).toBe(T[lang][el.dataset.tAria as CopyKey]);
			for (const el of placeholders) expect(el.getAttribute("placeholder")).toBe(T[lang][el.dataset.tPh as CopyKey]);
			for (const el of links) expect(el.getAttribute("href")).toBe(T[lang][el.dataset.tHref as CopyKey]);

			// No text, label or placeholder anywhere on the page is a dictionary key. A key that is also
			// a real text of the dictionary ("free" is the text of "r.free") cannot be told apart, so it is left out.
			const words = new Set([...Object.values(T.en), ...Object.values(T.pt)]);
			const shown = [
				...all("body *").flatMap((el) => [el.getAttribute("aria-label"), el.getAttribute("placeholder")]),
				...all("body *").flatMap((el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent)),
			].map((s) => s?.trim());
			expect(KEYS.filter((key) => !words.has(key) && shown.includes(key))).toEqual([]);
		});
	}

	it("keeps the English text of the markup word for word", () => {
		const before = all("[data-t]").map((el) => el.textContent);
		mount();
		expect(outsideTwin("[data-t]").map((el) => el.textContent)).toEqual(before);
	});

	it("marks the {key} words of the process text in green, in both languages", () => {
		mount();
		const key = () => document.querySelector('[data-t="pr.sub"] .key')?.textContent;
		expect(key()).toBe("every week");
		langButton("pt").click();
		expect(key()).toBe("toda semana");
	});
});

describe("the booking Frame", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("shows the next 3 weekdays in the chosen language, with no weekend", () => {
		// Friday 23 October 2026: the next weekdays are Monday 26, Tuesday 27 and Wednesday 28.
		vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 9, 23, 12) });
		mount();

		const days = () =>
			outsideTwin(".days .day").map((d) => [d.querySelector("small")?.textContent, d.querySelector("b")?.textContent]);
		expect(days()).toEqual([
			["Mon", "26"],
			["Tue", "27"],
			["Wed", "28"],
		]);
		expect(outsideTwin(".days .day.on").map((d) => d.querySelector("b")?.textContent)).toEqual(["27"]);

		langButton("pt").click();

		expect(days()).toEqual([
			["seg", "26"],
			["ter", "27"],
			["qua", "28"],
		]);
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

	it("sends book-call for each Book a call link", () => {
		mount();
		const links = outsideTwin<HTMLAnchorElement>("a").filter((a) => a.querySelector('[data-t="cta.book"]'));
		expect(links).toHaveLength(3);

		for (const link of links) link.querySelector("span")?.click();

		expect(events()).toEqual(["book-call", "book-call", "book-call"]);
	});

	it("sends whatsapp for the WhatsApp link of the hero", () => {
		mount();
		document.querySelector<HTMLElement>(".hero-cta .text-link")?.click();

		expect(events()).toEqual(["whatsapp"]);
	});

	it("sends lang/<id> when the visitor changes the language, not on restore and not for the same language", () => {
		localStorage.setItem("la.lang", "pt");
		mount();
		expect(events()).toEqual([]);

		langButton("pt").click();
		langButton("en").click();
		langButton("pt").click();

		expect(events()).toEqual(["lang/en", "lang/pt"]);
	});

	it("sends nothing for the other links", () => {
		mount();
		document.querySelector<HTMLElement>(".nav-links a")?.click();
		document.querySelector<HTMLElement>(".mark")?.click();

		expect(events()).toEqual([]);
	});

	it("sends nothing after dispose, and the switch does nothing", () => {
		mount().dispose();

		langButton("pt").click();
		document.querySelector<HTMLElement>(".hero-cta .pill")?.click();

		expect(document.documentElement.lang).toBe("en");
		expect(events()).toEqual([]);
	});
});
