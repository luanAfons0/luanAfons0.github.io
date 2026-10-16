import { checkContent, type Exhibit, KIND_LABELS, partLabel } from "../game/content";
import { FACE_OFFSETS, type Level, type Room, roomAt } from "../game/level";

export interface SkipViewInput {
	/** The Content: every Exhibit. */
	content: readonly Exhibit[];
	/** The Level: its Rooms and where each Exhibit hangs. */
	level: Pick<Level, "rooms" | "exhibits">;
	/**
	 * The site base path (Vite `base`), for example `/portfolio/`. The Title Screen is there.
	 * Only the Title Screen link uses it: Vite adds the base to asset URLs (stylesheet, icon) itself.
	 */
	base: string;
	/** The href of the page stylesheet. Vite rewrites a source path to the built file. */
	stylesheet?: string;
}

/**
 * The Skip View builder (Seam 2). It makes the Skip View page from the Content and the Rooms, at
 * build time: static, semantic HTML with every Exhibit under its Room, and no script.
 * An Exhibit is in the Room the player stands in to see it: the cell in front of its poster.
 * It fails with an error that names the Exhibit when the Content and the Level do not match, or
 * when the Content is not valid (see `checkContent`).
 */
export function buildSkipView({ content, level, base, stylesheet }: SkipViewInput): string {
	// The same check as the Game core, so the build fails the same way the game would.
	checkContent(level.exhibits, content);
	const groups = new Map<Room, Exhibit[]>(level.rooms.map((room) => [room, []]));
	for (const exhibit of content) groups.get(roomOf(exhibit, level))?.push(exhibit);
	const rooms = [...groups]
		.filter(([, exhibits]) => exhibits.length > 0)
		.map(([room, exhibits], index) => ({ room, exhibits, anchor: `room-${index + 1}` }));

	return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Luan Afonso, portfolio (Skip View)</title>
<meta name="description" content="Luan Afonso's portfolio: projects, jobs, skills, and contact info.">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
${stylesheet ? `<link rel="stylesheet" href="${escapeHtml(stylesheet)}">` : ""}
</head>
<body>
<div class="skip-page">
<header class="skip-header">
<a class="skip-back" href="${escapeHtml(base)}"><span aria-hidden="true">&larr;</span> Back to the Title Screen</a>
<p class="skip-datasheet only-paper"><span class="skip-part-number">LA-1</span> <span class="skip-datasheet-title">Portfolio, readable</span></p>
<h1>Luan Afonso</h1>
<p class="skip-lede">My portfolio: every Exhibit from the game, Room by Room.</p>
</header>
<nav class="skip-contents" aria-label="Contents">
<h2><span class="only-paper">Contents</span><span class="only-board">Rooms</span></h2>
<ol>
${rooms.map(({ room, exhibits, anchor }) => `<li><a href="#${anchor}"><span class="skip-contents-room">${escapeHtml(room.name)}</span><span class="skip-contents-parts">${exhibits.map((e) => partLabel(content, e)).join(", ")}</span></a></li>`).join("\n")}
</ol>
</nav>
<main>
${rooms.map(({ room, exhibits, anchor }) => roomSection(room, exhibits, anchor, content)).join("\n")}
</main>
</div>
</body>
</html>
`;
}

function roomOf(exhibit: Exhibit, level: SkipViewInput["level"]): Room {
	const placement = level.exhibits.find((p) => p.id === exhibit.id);
	if (!placement) throw new Error(`Exhibit "${exhibit.id}" is in the Content but not placed in the Level.`);
	const [dx, dy] = FACE_OFFSETS[placement.face];
	const room = roomAt(level.rooms, placement.x + dx + 0.5, placement.y + dy + 0.5);
	if (!room) throw new Error(`Exhibit "${exhibit.id}" is seen from no Room. Put its poster on a wall of a Room.`);
	return room;
}

function roomSection(room: Room, exhibits: readonly Exhibit[], anchor: string, content: readonly Exhibit[]): string {
	return `<section class="skip-room" aria-labelledby="${anchor}">
<h2 id="${anchor}">${escapeHtml(room.name)}</h2>
<ul class="skip-exhibits">
${exhibits.map((exhibit) => `<li>${exhibitArticle(exhibit, content)}</li>`).join("\n")}
</ul>
</section>`;
}

function exhibitArticle(exhibit: Exhibit, content: readonly Exhibit[]): string {
	const links =
		exhibit.links.length === 0
			? ""
			: `<ul class="skip-links">
${exhibit.links.map(({ label, url }) => `<li><a href="${escapeHtml(url)}">${escapeHtml(label)}</a></li>`).join("\n")}
</ul>`;
	return `<article class="skip-exhibit" id="exhibit-${escapeHtml(exhibit.id)}">
<span class="skip-part">${partLabel(content, exhibit)}</span>
<div class="skip-body">
<p class="skip-kind">${escapeHtml(KIND_LABELS[exhibit.kind])}</p>
<h3>${escapeHtml(exhibit.title)}</h3>
<p class="skip-summary">${escapeHtml(exhibit.summary)}</p>
${exhibit.details.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("\n")}
${links}
</div>
</article>`;
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escapes text for HTML text and for quoted attribute values. */
function escapeHtml(text: string): string {
	return text.replace(/[&<>"']/g, (char) => ESCAPES[char] as string);
}
