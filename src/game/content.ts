/**
 * The Content: the one typed source of every Exhibit. The game and the Skip View read it.
 * The Level places each Exhibit on a wall by its `id` (see `src/game/levels/`).
 * Creating the Game core and building the Skip View fail when the Level and this list do not
 * match (see `checkContent`).
 *
 * It has no imports, so the art generator (`scripts/machine-art.ts`) can read it in Node.
 */

export type ExhibitKind = "project" | "job" | "skill" | "contact";

/** The label a visitor reads for each kind of Exhibit. */
export const KIND_LABELS: Record<ExhibitKind, string> = {
	project: "Project",
	job: "Job",
	skill: "Skill",
	contact: "Contact",
};

/** The letter of each kind in a Part label: project U, contact J, skill R, job Q. */
const PART_LETTERS: Record<ExhibitKind, string> = {
	project: "U",
	contact: "J",
	skill: "R",
	job: "Q",
};

/**
 * The Part label of an Exhibit, such as "U1": the letter of its kind and its order among the
 * Exhibits of that kind in the Content, from 1. Derived, never stored. It fails when the Exhibit
 * is not in the Content.
 */
export function partLabel(content: readonly { id: string; kind: ExhibitKind }[], exhibit: { id: string }): string {
	const index = content.findIndex((e) => e.id === exhibit.id);
	const found = content[index];
	if (!found) throw new Error(`Exhibit "${exhibit.id}" is not in the Content, so it has no Part label.`);
	const order = content.slice(0, index + 1).filter((e) => e.kind === found.kind).length;
	return `${PART_LETTERS[found.kind]}${order}`;
}

export interface ExhibitLink {
	label: string;
	/** An absolute `http:`, `https:`, or `mailto:` URL. */
	url: string;
}

/** The only link schemes an Exhibit may use: no script URLs, no data URLs. */
const LINK_PROTOCOLS: ReadonlySet<string> = new Set(["http:", "https:", "mailto:"]);

export interface Exhibit {
	/** The key the Level uses to place the Exhibit. */
	id: string;
	kind: ExhibitKind;
	title: string;
	/** One or two sentences. */
	summary: string;
	/** The full details, one paragraph per item. */
	details: readonly string[];
	links: readonly ExhibitLink[];
	/**
	 * The poster image, a PNG path relative to `public/` in the machine art folder (for example
	 * `machine/posters/orca.png`). The generator draws it with the Exhibit's Part label.
	 */
	poster: string;
}

/**
 * Fails with an error that names the `id` when the Content is not valid or does not match the
 * Level Exhibits: two Exhibits with one id, a link that is not an http, https, or mailto URL, a
 * Level Exhibit with no Content, or a Content Exhibit the Level does not place.
 */
export function checkContent(placements: readonly { id: string }[], content: readonly Exhibit[]): void {
	const ids = new Set<string>();
	for (const { id, links } of content) {
		if (ids.has(id)) throw new Error(`The Content has two Exhibits with the id "${id}".`);
		ids.add(id);
		for (const { url } of links) {
			if (!LINK_PROTOCOLS.has(protocolOf(url))) {
				throw new Error(`Exhibit "${id}" has the link "${url}". Use an http, https, or mailto URL.`);
			}
		}
	}
	for (const { id } of placements) {
		if (!ids.has(id)) throw new Error(`The Level places Exhibit "${id}", but the Content has no Exhibit with that id.`);
	}
	for (const { id } of content) {
		if (!placements.some((placement) => placement.id === id)) {
			throw new Error(`The Content has Exhibit "${id}", but the Level does not place it.`);
		}
	}
}

/** The scheme of an absolute URL, like `https:`, or "" when it is not an absolute URL. */
function protocolOf(url: string): string {
	try {
		return new URL(url).protocol;
	} catch {
		return "";
	}
}

/** Sample Exhibits, one of each kind. The real content replaces them later. */
export const EXHIBITS: readonly Exhibit[] = [
	{
		id: "project-portfolio",
		kind: "project",
		title: "This portfolio",
		summary: "A Doom-inspired first-person game in the browser that presents my work.",
		details: [
			"A raycasting renderer written from scratch in TypeScript. It draws textured walls, posters, and a status bar into a 640x360 framebuffer at 60 FPS.",
			"The Level is drawn in the Tiled map editor. All Exhibit content comes from one typed source, and the tests fail when the Level and the content do not match.",
		],
		links: [{ label: "Source code", url: "https://github.com/luanAfons0/portfolio" }],
		poster: "machine/posters/project-portfolio.png",
	},
	{
		id: "job-sample",
		kind: "job",
		title: "Software Engineer at Sample Company",
		summary: "Sample job. The real work history comes later.",
		details: ["Built and ran web services for a sample product.", "Worked with a small team, from design to deploy."],
		links: [],
		poster: "machine/posters/job-sample.png",
	},
	{
		id: "skill-typescript",
		kind: "skill",
		title: "TypeScript",
		summary: "Strict TypeScript for browsers and Node.",
		details: ["Typed domain models, test-first development, and small dependency-free modules."],
		links: [{ label: "TypeScript", url: "https://www.typescriptlang.org/" }],
		poster: "machine/posters/skill-typescript.png",
	},
	{
		id: "contact",
		kind: "contact",
		title: "Contact",
		summary: "Want to talk? Find me on GitHub.",
		details: ["I read every message."],
		links: [{ label: "GitHub", url: "https://github.com/luanAfons0" }],
		poster: "machine/posters/contact.png",
	},
];
