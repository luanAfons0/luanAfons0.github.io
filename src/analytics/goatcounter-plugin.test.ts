import { describe, expect, it } from "vitest";
import { goatCounter } from "./goatcounter-plugin";

const TAG =
	'<script data-goatcounter="https://luanafons0.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>';

function transform(html: string): string {
	const hook = goatCounter().transformIndexHtml;
	if (typeof hook !== "object" || hook === null || !("handler" in hook))
		throw new Error("no transformIndexHtml handler");
	const handler = hook.handler as (html: string) => string;
	return handler(html);
}

describe("GoatCounter plugin", () => {
	it("runs in the production build only, so the dev server and the tests are not counted", () => {
		expect(goatCounter().apply).toBe("build");
	});

	it("puts the script tag at the end of the head", () => {
		const html = "<html><head><title>Home</title></head><body><h1>Home</h1></body></html>";

		expect(transform(html)).toBe(`<html><head><title>Home</title>${TAG}</head><body><h1>Home</h1></body></html>`);
	});
});
