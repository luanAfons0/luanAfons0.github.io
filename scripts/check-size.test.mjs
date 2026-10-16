import { randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkSize } from "./check-size.mjs";

function fakeDist(files) {
	const root = mkdtempSync(join(tmpdir(), "size-"));
	mkdirSync(join(root, "assets"));
	for (const [name, content] of Object.entries(files)) writeFileSync(join(root, "assets", name), content);
	return root;
}

describe("checkSize", () => {
	it("passes when the gzipped JavaScript is under the limit", () => {
		const result = checkSize(fakeDist({ "a.js": "x".repeat(50_000) }), 1024);
		expect(result.ok).toBe(true);
		expect(result.total).toBeLessThan(1024);
	});

	it("fails when the gzipped JavaScript is over the limit", () => {
		const result = checkSize(fakeDist({ "a.js": randomBytes(2048).toString("hex") }), 1024);
		expect(result.ok).toBe(false);
	});

	it("adds up all JavaScript files and ignores other files", () => {
		const dist = fakeDist({
			"a.js": randomBytes(600).toString("hex"),
			"b.js": randomBytes(600).toString("hex"),
			"c.css": randomBytes(9000).toString("hex"),
		});
		const result = checkSize(dist, 1_000_000);
		expect(result.files.map((f) => f.name).sort()).toEqual(["a.js", "b.js"]);
		expect(result.total).toBe(result.files[0].bytes + result.files[1].bytes);
	});

	it("fails when there is no JavaScript to measure", () => {
		expect(checkSize(fakeDist({}), 1024).ok).toBe(false);
	});
});
