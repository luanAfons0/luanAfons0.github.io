import { checkContent, type Exhibit, KIND_LABELS, partLabel } from "../game/content";
import { FACE_OFFSETS, type Level, type Room, roomAt } from "../game/level";
import { DEFAULT_THEME } from "../game/theme";
import { THEME_SCRIPT_MARK } from "../theme-script";

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
 * build time: static, semantic HTML with every Exhibit under its Room. It writes no script: its head
 * has the mark where the `theme-script` plugin puts the Theme head script, and the page works fully
 * without it: its root carries the default Theme as `data-theme`, which the script replaces with a
 * saved Theme.
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
<html lang="en" data-theme="${DEFAULT_THEME}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Luan Afonso, portfolio (Skip View)</title>
<meta name="description" content="Luan Afonso's portfolio: projects, jobs, skills, and contact info.">
<meta name="color-scheme" content="light dark">
${THEME_SCRIPT_MARK}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
${stylesheet ? `<link rel="stylesheet" href="${escapeHtml(stylesheet)}">` : ""}
</head>
<body class="dungeon-cover">
<div class="skip-page">
<a class="skip-back" href="${escapeHtml(base)}">${BACK_ARROW} Back to the Title Screen</a>
<div class="skip-sheet dungeon-pulp">
<header class="skip-header">
<p class="skip-datasheet only-paper"><span class="skip-part-number">LA-1</span> <span class="skip-datasheet-title">Portfolio, readable</span></p>
<p class="skip-runhead only-dungeon" aria-hidden="true"><span>Every page</span><span>Luan Afonso</span></p>
<h1>Luan Afonso</h1>
<p class="skip-lede">My portfolio: every Exhibit from the game, Room by Room. <span class="skip-sample only-dungeon">Sample content</span></p>
</header>
<nav class="skip-contents" aria-label="Contents">
<h2>Rooms</h2>
<ol>
${rooms.map(({ room, exhibits, anchor }) => `<li><a href="#${anchor}"><span class="skip-contents-room">${escapeHtml(room.name)}</span><span class="skip-contents-parts">${exhibits.map((e) => partLabel(content, e)).join(", ")}</span></a></li>`).join("\n")}
</ol>
</nav>
<main>
${rooms.map(({ room, exhibits, anchor }) => roomSection(room, exhibits, anchor, content)).join("\n")}
</main>
<p class="skip-end only-dungeon" aria-hidden="true">The end of the book.</p>
</div>
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
	const part = partLabel(content, exhibit);
	const kind = escapeHtml(KIND_LABELS[exhibit.kind]);
	return `<article class="skip-exhibit" id="exhibit-${escapeHtml(exhibit.id)}">
<p class="skip-section-number only-dungeon" role="img" aria-label="${kind} ${part}"><span>${part}</span></p>
<p class="skip-section-kind only-dungeon" aria-hidden="true">${kind}</p>
<div class="skip-gutter">
<span class="skip-part">${part}</span>
<p class="skip-kind">${kind}</p>
</div>
<div class="skip-body">
<h3>${escapeHtml(exhibit.title)}</h3>
<p class="skip-summary">${escapeHtml(exhibit.summary)}</p>
${exhibit.details.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("\n")}
${links}
</div>
</article>`;
}

/** A left arrow drawn on an 8 by 8 pixel grid, shown at 16 by 16 pixels: whole-pixel, crisp edges. */
const BACK_ARROW =
	'<svg class="skip-arrow" width="16" height="16" viewBox="0 0 8 8" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true"><path d="M3 1h1v1H3zM2 2h2v1H2zM0 3h8v2H0zM2 5h2v1H2zM3 6h1v1H3z"/></svg>';

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escapes text for HTML text and for quoted attribute values. */
function escapeHtml(text: string): string {
	return text.replace(/[&<>"']/g, (char) => ESCAPES[char] as string);
}
