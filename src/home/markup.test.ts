// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

// The Home page with JavaScript off: the real `index.html`, parsed as the browser gets it.
const HTML = readFileSync(resolve(import.meta.dirname, "../../index.html"), "utf8");

// The test runs with no server, so it drops the one style sheet link that happy-dom would fetch.
let page: Document;
beforeEach(() => {
	page = new DOMParser().parseFromString(HTML.replace(/<link rel="stylesheet"[^>]*>/, ""), "text/html");
});

function all<T extends Element = Element>(selector: string): T[] {
	return [...page.querySelectorAll<T>(selector)];
}

describe("the Home page markup", () => {
	it("has every part of the mock, in the mock's order", () => {
		expect(page.querySelector("header.nav .map > .map-fill")).not.toBeNull();
		expect(all("main > section").map((s) => s.id || s.className)).toEqual([
			"hero wrap",
			"services",
			"packages",
			"builder",
			"process",
			"demos",
			"faq",
			"contact",
		]);
		expect(page.querySelector("main + footer.foot .foot-name")?.textContent).toBe("Luan Afonso");
	});

	it("has the 4 Frames, the 4 Timeline ticks and the 4 Chapters, the first one active", () => {
		for (const selector of [".fan > .frame", ".tl-axis > .tl-tick", ".chapters > .chapter", ".fs > .fs-stop"]) {
			expect(all(selector)).toHaveLength(4);
		}
		for (const selector of [".frame", ".tl-tick", ".chapter"]) {
			expect(all(`${selector}.is-active`)).toEqual([page.querySelector(selector)]);
		}
	});

	it("keeps the Phosphor symbols the page uses", () => {
		expect(all("svg symbol").map((s) => s.id)).toEqual(["i-arrow", "i-check", "i-plus", "i-flag"]);
		const used = new Set(all("use").map((u) => u.getAttribute("href")));
		expect([...used].sort()).toEqual(["#i-arrow", "#i-check", "#i-flag", "#i-plus"]);
	});

	it("has the head of the page: lang, title, description, color scheme, viewport, favicon and styles", () => {
		expect(HTML).toContain('<link rel="stylesheet" href="/src/home/home.css">');
		expect(page.documentElement.lang).toBe("en");
		expect(page.title).toBe("Luan Afonso Freelance");
		expect(page.querySelector('meta[name="description"]')?.getAttribute("content")).toMatch(/Shopify/);
		expect(page.querySelector('meta[name="color-scheme"]')?.getAttribute("content")).toBe("light");
		expect(page.querySelector('meta[name="viewport"]')?.getAttribute("content")).toBe(
			"width=device-width, initial-scale=1, viewport-fit=cover",
		);
		expect(page.querySelector('link[rel="icon"]')?.getAttribute("href")).toBe("/favicon.svg");
	});

	it("self-hosts and preloads Geist and Geist Mono, with no Google Fonts", () => {
		expect(HTML).not.toMatch(/fonts\.googleapis|fonts\.gstatic/);
		expect(all('link[rel="preload"][as="font"]').map((l) => l.getAttribute("href"))).toEqual([
			"/fonts/geist/geist-latin-wght-normal.woff2",
			"/fonts/geist-mono/geist-mono-latin-wght-normal.woff2",
		]);
		for (const link of all('link[rel="preload"][as="font"]')) {
			expect(link.hasAttribute("crossorigin")).toBe(true);
			expect(link.getAttribute("type")).toBe("font/woff2");
		}
	});

	it("shows the demo-store photos as files with their size set", () => {
		const photos = all("img");
		expect(photos.map((img) => img.getAttribute("src"))).toEqual([
			"/photos/demo-coffee.jpg",
			"/photos/demo-coffee.jpg",
			"/photos/demo-coffee2.jpg",
			"/photos/demo-box.jpg",
			"/photos/demo-tee2.jpg",
			"/photos/demo-dress.jpg",
			"/photos/demo-tee.jpg",
		]);
		for (const img of photos) {
			expect([img.getAttribute("width"), img.getAttribute("height"), img.getAttribute("alt")]).toEqual([
				"400",
				"500",
				"",
			]);
		}
	});

	it("credits each photo author with the license link and the cropped note", () => {
		const credits = page.querySelector(".credits");
		expect(credits?.textContent).toMatch(/cropped/);
		const links = [...(credits?.querySelectorAll("a") ?? [])].map((a) => [a.textContent, a.getAttribute("href")]);
		expect(links).toEqual([
			["Alorin", "https://commons.wikimedia.org/wiki/File:Roasted_coffee_beans_in_white_bowl.png"],
			["CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/"],
			["MarkSweep", "https://commons.wikimedia.org/wiki/File:Roasted_coffee_beans.jpg"],
			["Jamain", "https://commons.wikimedia.org/wiki/File:A_bag_of_coffee_J1.jpg"],
			["CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0/"],
			["Pajju12", "https://commons.wikimedia.org/wiki/File:Clean-blank-shirt-hanger.jpg"],
			["CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0/"],
			[
				"Hunt Museum and Inés Rivilla López",
				"https://commons.wikimedia.org/wiki/File:Grey_Linen_Pleated_Dress_designed_by_Sybil_Connolly_-_Full_Length_Back.jpg",
			],
			["CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0/"],
			["THOR", "https://commons.wikimedia.org/wiki/File:Ringflash_Tshirt_Blank_Template_(3214240974).jpg"],
			["CC BY 2.0", "https://creativecommons.org/licenses/by/2.0/"],
		]);
	});

	it("shows the Project builder as the mock first renders it: Store launch and Speed audit on", () => {
		const picks = all("#picks > .pick");
		expect(
			picks.map((p) => [p.querySelector(".pick-name")?.textContent, p.querySelector(".pick-price")?.textContent]),
		).toEqual([
			["Store launch", "+$900"],
			["Store fix", "+$160"],
			["Care plan, first month", "+$120"],
			["Speed audit", "Free"],
			["Product import", "+$100"],
			["Custom section", "+$180"],
			["Second language", "+$140"],
		]);
		const on = all<HTMLInputElement>("input.switch").filter((i) => i.checked);
		expect(on.map((i) => i.dataset.pick)).toEqual(["launch", "audit"]);
		expect(all("#strip > .seg").map((s) => s.textContent)).toEqual(["1", "2"]);
		expect(all("#r-lines > .line").map((l) => l.textContent)).toEqual(["1Store launch$900", "2Speed auditfree"]);
		expect(page.querySelector("#r-total")?.getAttribute("aria-label")).toBe("$900");
		expect(all("[data-add][aria-pressed=true]").map((b) => b.getAttribute("data-add"))).toEqual(["launch"]);
	});

	it("has no link to a missing id", () => {
		for (const a of all("a[href^='#']")) {
			const id = a.getAttribute("href")?.slice(1);
			if (id) expect(page.getElementById(id), id).not.toBeNull();
		}
	});
});
