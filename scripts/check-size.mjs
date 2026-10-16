import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

/** The size budget: all JavaScript in the build, gzipped. */
export const LIMIT_BYTES = 100 * 1024;

/**
 * Measures the gzipped size of every `.js` file in `<dist>/assets`.
 * Returns `ok: false` when the total is over `limit`, or when there is no JavaScript at all.
 */
export function checkSize(dist, limit = LIMIT_BYTES) {
	const dir = join(dist, "assets");
	const names = readdirSync(dir).filter((name) => name.endsWith(".js"));
	const files = names.map((name) => ({ name, bytes: gzipSync(readFileSync(join(dir, name)), { level: 6 }).length }));
	const total = files.reduce((sum, file) => sum + file.bytes, 0);
	return { ok: files.length > 0 && total <= limit, files, total, limit };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const result = checkSize(process.argv[2] ?? "dist");
	for (const file of result.files) console.log(`${file.name}: ${(file.bytes / 1024).toFixed(1)} KB gzip`);
	console.log(`total JS: ${(result.total / 1024).toFixed(1)} KB gzip (limit ${result.limit / 1024} KB)`);
	if (!result.ok) {
		console.error(result.files.length === 0 ? "No JavaScript found to measure." : "Over the size budget.");
		process.exit(1);
	}
}
