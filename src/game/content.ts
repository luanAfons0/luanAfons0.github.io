/**
 * The Content: the one typed source of every Exhibit. The game and the Skip View read it.
 * The Level places each Exhibit on a wall by its `id` (see `src/game/levels/`).
 * Creating the Game core fails when the Level and this list do not match.
 */

export type ExhibitKind = "project" | "job" | "skill" | "contact";

/** The label a visitor reads for each kind of Exhibit. */
export const KIND_LABELS: Record<ExhibitKind, string> = {
	project: "Project",
	job: "Job",
	skill: "Skill",
	contact: "Contact",
};

export interface ExhibitLink {
	label: string;
	url: string;
}

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
	/** The poster image, a PNG path relative to `public/` (for example `posters/orca.png`). */
	poster: string;
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
		poster: "posters/project-portfolio.png",
	},
	{
		id: "job-sample",
		kind: "job",
		title: "Software Engineer at Sample Company",
		summary: "Sample job. The real work history comes later.",
		details: ["Built and ran web services for a sample product.", "Worked with a small team, from design to deploy."],
		links: [],
		poster: "posters/job-sample.png",
	},
	{
		id: "skill-typescript",
		kind: "skill",
		title: "TypeScript",
		summary: "Strict TypeScript for browsers and Node.",
		details: ["Typed domain models, test-first development, and small dependency-free modules."],
		links: [{ label: "TypeScript", url: "https://www.typescriptlang.org/" }],
		poster: "posters/skill-typescript.png",
	},
	{
		id: "contact",
		kind: "contact",
		title: "Contact",
		summary: "Want to talk? Find me on GitHub.",
		details: ["I read every message."],
		links: [{ label: "GitHub", url: "https://github.com/luanAfons0" }],
		poster: "posters/contact.png",
	},
];
