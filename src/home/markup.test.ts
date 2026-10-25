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
			"process",
			"demos",
			"faq",
			"builder",
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
		expect(all("svg symbol").map((s) => s.id)).toEqual([
			"i-arrow",
			"i-check",
			"i-plus",
			"i-flag",
			"i-up-right",
			"i-copy",
		]);
		const used = new Set(all("use").map((u) => u.getAttribute("href")));
		expect([...used].sort()).toEqual(["#i-arrow", "#i-check", "#i-copy", "#i-flag", "#i-plus", "#i-up-right"]);
	});

	it("has the head of the page: lang, title, description, color scheme, viewport, favicon and styles", () => {
		expect(HTML).toContain('<link rel="stylesheet" href="/src/home/home.css">');
		expect(page.documentElement.lang).toBe("en");
		expect(page.title).toBe("Luan portfolio");
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

	it("shows the Filmstrip photo as a file with its size set", () => {
		const photos = all("#services img");
		expect(photos.map((img) => img.getAttribute("src"))).toEqual(["/photos/demo-coffee.jpg"]);
		for (const img of photos) {
			expect([img.getAttribute("width"), img.getAttribute("height"), img.getAttribute("alt")]).toEqual([
				"400",
				"500",
				"",
			]);
		}
	});

	it("credits the photo author with the license link and the cropped note, and names the store screens", () => {
		const credits = page.querySelector(".credits");
		expect(credits?.textContent).toMatch(/cropped/);
		expect(credits?.querySelector('[data-t="foot.screens"]')?.textContent).toMatch(/recorded from my demo stores/);
		const links = [...(credits?.querySelectorAll("a") ?? [])].map((a) => [a.textContent, a.getAttribute("href")]);
		expect(links).toEqual([
			["Alorin", "https://commons.wikimedia.org/wiki/File:Roasted_coffee_beans_in_white_bowl.png"],
			["CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/"],
		]);
	});

	it("shows the three Demo stores, each labelled Demo, with its link in a new tab and its password", () => {
		const stores = all("#demos .store");
		const rows = stores.map((store) => {
			const link = store.querySelector("a.pill");
			return [
				store.querySelector("h3")?.textContent,
				store.querySelector(".tag")?.textContent,
				link?.getAttribute("href"),
				link?.getAttribute("target"),
				link?.getAttribute("rel"),
				store.querySelector(".pw code")?.textContent,
				store.querySelector(".pw [data-copy]")?.getAttribute("data-copy"),
			];
		});
		expect(rows).toEqual([
			["Café Serra", "Demo", "https://cafe-serra.myshopify.com/", "_blank", "noopener", "serra", "pw-serra"],
			["Ateliê Lume", "Demo", "https://atelielume.myshopify.com/", "_blank", "noopener", "lume", "pw-lume"],
			["Orvalho", "Demo", "https://orvalho-ovejqhyy.myshopify.com/", "_blank", "noopener", "orvalho", "pw-orvalho"],
		]);
		expect(all("#demos .store-score .num").map((n) => n.textContent)).toEqual(["83", "86", "79"]);
		expect(all("#demos .mock-note")).toHaveLength(0);
	});

	it("shows every store card with JavaScript off, and keeps the store tiles hidden until the script runs", () => {
		expect(all("#demos .store")).toHaveLength(3);
		expect(page.querySelector<HTMLElement>("#demos .tabs")?.hidden).toBe(true);
		expect(all("#demos .tab").map((t) => t.getAttribute("aria-controls"))).toEqual(["p-serra", "p-lume", "p-orvalho"]);
	});

	it("loads the store recordings only on demand, muted, with a poster for each", () => {
		const videos = all<HTMLVideoElement>("#demos video");
		expect(videos).toHaveLength(6);
		for (const video of videos) {
			expect(video.hasAttribute("autoplay")).toBe(false);
			expect(video.hasAttribute("muted")).toBe(true);
			expect(video.getAttribute("preload")).toBe("none");
			expect(video.getAttribute("poster")).toMatch(/^\/demo-stores\/[a-z-]+-poster\.jpg$/);
			expect(video.getAttribute("src")).toMatch(/^\/demo-stores\/[a-z-]+\.mp4$/);
		}
	});

	it("shows the Project builder as the mock first renders it: Store launch and Speed audit on", () => {
		expect(all("#picks > .pick .pick-name").map((n) => n.textContent)).toEqual([
			"Store launch",
			"Store fix",
			"Care plan, first month",
			"Speed audit",
			"Product import",
			"Custom section",
			"Second language",
		]);
		const on = all<HTMLInputElement>("input.switch").filter((i) => i.checked);
		expect(on.map((i) => i.dataset.pick)).toEqual(["launch", "audit"]);
		expect(all("#strip > .seg").map((s) => s.textContent)).toEqual(["1", "2"]);
		expect(all("#r-lines > .line").map((l) => l.textContent)).toEqual(["1Store launch", "2Speed audit"]);
		expect(page.querySelector("#est-title")?.textContent).toBe("Your project");
	});

	it("shows no service price with JavaScript off, only the Demo store prices", () => {
		for (const selector of ["#packages", "[data-add]", "[data-price]", ".pick-price", "#r-total"]) {
			expect(all(selector), selector).toHaveLength(0);
		}
		expect(all("[data-demo-price]").length).toBeGreaterThan(0);
	});

	it("has a Book a call link in the builder that fills the message and goes to the contact form", () => {
		const link = page.querySelector("#builder a[data-prefill]");
		expect(link?.getAttribute("href")).toBe("#contact");
		expect(link?.textContent).toMatch(/Book a call/);
	});

	it("shows all 4 Chapters, stacked, with JavaScript off", () => {
		// The page with its styles, as a browser with JavaScript off applies them: the `<noscript>` style counts.
		// The build moves the style sheet to the end of the head, after the `<noscript>`, so the test does too.
		const css = readFileSync(resolve(import.meta.dirname, "home.css"), "utf8");
		const styled = new DOMParser().parseFromString(
			HTML.replace(/<link rel="stylesheet"[^>]*>/, "").replace("</head>", `<style>${css}</style></head>`),
			"text/html",
		);
		document.documentElement.innerHTML = styled.documentElement.innerHTML;

		const chapters = [...document.querySelectorAll(".chapters > .chapter")].map((c) => getComputedStyle(c));
		expect(chapters).toHaveLength(4);
		for (const chapter of chapters) {
			expect([chapter.visibility, chapter.opacity, chapter.gridArea]).toEqual(["visible", "1", "auto"]);
		}
		// With JavaScript on, the browser ignores the `<noscript>` style, so the mock's look stays.
		expect(document.querySelector("head > noscript > style")).not.toBeNull();
	});

	it("posts the form to the form service with JavaScript off, in the body and never in a URL", () => {
		const form = page.querySelector<HTMLFormElement>("#form");
		expect(form?.getAttribute("action")).toBe("https://api.web3forms.com/submit");
		expect(form?.method.toLowerCase()).toBe("post");
		// The browser checks the necessary fields itself; the script turns this off and checks them in its place.
		expect(form?.hasAttribute("novalidate")).toBe(false);
		expect(all("#form [required]").map((f) => f.getAttribute("name"))).toEqual(["name", "email", "message"]);
		expect(page.querySelector<HTMLInputElement>('#form input[name="access_key"]')?.value).toMatch(/^[0-9a-f-]{36}$/);
		// The spam trap: people never see it, so only a bot checks it.
		const trap = page.querySelector<HTMLInputElement>('#form input[name="botcheck"]');
		expect(trap?.hidden).toBe(true);
		expect(trap?.tabIndex).toBe(-1);
	});

	it("has LinkedIn in the contact channels and in the footer, and no link that goes nowhere", () => {
		const profile = "https://www.linkedin.com/in/luan-henrique-afonso/?locale=en-US";
		expect(page.querySelector("#contact .channels a")?.getAttribute("href")).toBe(profile);
		// The Open button opens the profile in a new tab, so the visitor keeps the page.
		expect(page.querySelector("#contact .channels a")?.getAttribute("target")).toBe("_blank");
		expect(page.querySelector("#contact .channels a")?.getAttribute("rel")).toBe("noopener");
		// The footer profiles (GitHub, LinkedIn) do the same; the page links (FAQ, Back to the top) stay in the tab.
		const footer = all<HTMLAnchorElement>("footer.foot nav a");
		expect(footer.map((l) => [l.textContent, l.getAttribute("target"), l.getAttribute("rel")])).toEqual([
			["GitHub", "_blank", "noopener"],
			["LinkedIn", "_blank", "noopener"],
			["FAQ", null, null],
			["Back to the top", null, null],
		]);
		expect(page.querySelector("footer.foot nav a[data-t-href]")?.getAttribute("href")).toBe(profile);
		expect(all('a[href="#"]')).toHaveLength(0);
		expect(all("#contact .mock-note")).toHaveLength(0);
	});

	it("opens a WhatsApp chat with Luan from the hero, in a new tab", () => {
		const link = page.querySelector(".hero-cta .text-link");
		expect(link?.getAttribute("href")).toBe("https://wa.me/5516997638477");
		expect([link?.getAttribute("target"), link?.getAttribute("rel")]).toEqual(["_blank", "noopener"]);
	});

	it("has no link to a missing id", () => {
		for (const a of all("a[href^='#']")) {
			const id = a.getAttribute("href")?.slice(1);
			if (id) expect(page.getElementById(id), id).not.toBeNull();
		}
	});
});
