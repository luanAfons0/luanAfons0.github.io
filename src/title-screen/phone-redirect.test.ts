import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

const BASE = "/portfolio/";
const PAGE = readFileSync(resolve(import.meta.dirname, "../../index.html"), "utf8").replaceAll("%BASE_URL%", BASE);

/** The inline script in the page head: the phone redirect. It must come before every stylesheet, so it runs before the first paint. */
function redirectScript(): string {
	const head = PAGE.slice(0, PAGE.indexOf("</head>"));
	const match = /<script>([\s\S]*?)<\/script>/.exec(head);
	if (!match?.[1]) throw new Error("index.html has no inline script in its head.");
	expect(head.indexOf("<script>")).toBeLessThan(head.indexOf("<link"));
	return match[1];
}

/** Runs the redirect script on a device whose pointers match the given media queries. */
function visit(matching: readonly string[]) {
	const replace = vi.fn();
	const matchMedia = (query: string) => ({ matches: matching.includes(query) });
	const document = { documentElement: { hidden: false } };
	new Function("matchMedia", "location", "document", redirectScript())(matchMedia, { replace }, document);
	return { replace, pageHidden: document.documentElement.hidden };
}

describe("phone redirect", () => {
	it("sends a phone (touch only) to the Skip View, out of the history, and paints nothing before it goes", () => {
		const { replace, pageHidden } = visit(["(pointer: coarse)", "(any-pointer: coarse)"]);
		expect(replace).toHaveBeenCalledWith(`${BASE}skip/`);
		expect(pageHidden).toBe(true);
	});

	it.each([
		["a desktop with a mouse", ["(pointer: fine)", "(any-pointer: fine)"]],
		[
			"a tablet with a mouse (touch is its main pointer)",
			["(pointer: coarse)", "(any-pointer: coarse)", "(any-pointer: fine)"],
		],
		["a touch laptop", ["(pointer: fine)", "(any-pointer: fine)", "(any-pointer: coarse)"]],
	])("keeps %s on the Title Screen", (_device, matching) => {
		const { replace, pageHidden } = visit(matching);
		expect(replace).not.toHaveBeenCalled();
		expect(pageHidden).toBe(false);
	});
});
