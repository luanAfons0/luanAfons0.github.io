// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { EXHIBITS, type Exhibit } from "./content";
import { createExhibitPanel } from "./exhibit-panel";

function sample(kind: Exhibit["kind"]): Exhibit {
	const exhibit = EXHIBITS.find((e) => e.kind === kind);
	if (!exhibit) throw new Error(`no sample ${kind}`);
	return exhibit;
}

/** The text of each section heading, then of the elements under it, in page order. */
function headingsAndText(): string[] {
	const body = document.querySelector(".exhibit-panel__body");
	return [...(body?.children ?? [])].map((node) => node.textContent ?? "");
}

describe("Exhibit Panel", () => {
	afterEach(() => {
		document.body.replaceChildren();
	});

	it("shows the Part label, named by its kind, and the kind in its header", () => {
		const panel = createExhibitPanel({ parent: document.body, onClose: () => {} });
		panel.open(sample("project"));
		const header = document.querySelector(".exhibit-panel__header");
		const part = header?.querySelector(".exhibit-panel__part");
		expect(part?.textContent).toBe("U1");
		expect(part?.getAttribute("aria-label")).toBe("Project U1");
		expect(header?.querySelector(".exhibit-panel__kind")?.textContent).toBe("Project");
	});

	it.each([
		["contact", "Contact J1"],
		["skill", "Skill R1"],
		["job", "Job Q1"],
	] as const)("names the Part label of a %s Exhibit by its kind for screen readers", (kind, name) => {
		const panel = createExhibitPanel({ parent: document.body, onClose: () => {} });
		panel.open(sample(kind));
		const part = document.querySelector(".exhibit-panel__part");
		expect(part?.getAttribute("role")).toBe("img");
		expect(part?.getAttribute("aria-label")).toBe(name);
	});

	it("shows the title, the summary, the details under Description, and the links under Links", () => {
		const panel = createExhibitPanel({ parent: document.body, onClose: () => {} });
		const project = sample("project");
		panel.open(project);
		expect(document.querySelector("h2")?.textContent).toBe(project.title);
		expect(headingsAndText()).toEqual([
			project.title,
			project.summary,
			"Description",
			...project.details,
			"Links",
			project.links.map((l) => l.label).join(""),
		]);
	});

	it("has no Links section for an Exhibit without links", () => {
		const panel = createExhibitPanel({ parent: document.body, onClose: () => {} });
		const job = sample("job");
		expect(job.links).toEqual([]);
		panel.open(job);
		expect(headingsAndText()).not.toContain("Links");
		expect(document.querySelector(".exhibit-panel__links")).toBeNull();
	});

	it("opens each link in a new tab", () => {
		const panel = createExhibitPanel({ parent: document.body, onClose: () => {} });
		panel.open(sample("project"));
		const link = document.querySelector<HTMLAnchorElement>(".exhibit-panel__link");
		expect(link?.href).toBe("https://github.com/luanAfons0/portfolio");
		expect(link?.target).toBe("_blank");
		expect(link?.rel).toBe("noopener noreferrer");
	});

	it("is a labelled dialog that takes focus when it opens", () => {
		const panel = createExhibitPanel({ parent: document.body, onClose: () => {} });
		expect(panel.isOpen()).toBe(false);
		panel.open(sample("skill"));
		expect(panel.isOpen()).toBe(true);
		const dialog = document.querySelector('[role="dialog"]');
		const titleId = dialog?.getAttribute("aria-labelledby") ?? "";
		expect(document.getElementById(titleId)?.textContent).toBe(sample("skill").title);
		expect(dialog?.contains(document.activeElement)).toBe(true);
	});

	it("shows the Esc key as a key cap on Close", () => {
		createExhibitPanel({ parent: document.body, onClose: () => {} }).open(sample("project"));
		const close = document.querySelector(".exhibit-panel__close");
		expect(close?.textContent).toBe("Close Esc");
		expect(close?.querySelector("kbd")?.textContent).toBe("Esc");
	});

	it("marks the Content as sample content in its foot", () => {
		createExhibitPanel({ parent: document.body, onClose: () => {} }).open(sample("project"));
		expect(document.querySelector(".exhibit-panel__foot")?.textContent).toContain("Sample content");
	});

	it("runs onClose when the player clicks Close, and closes at once", () => {
		const onClose = vi.fn();
		const panel = createExhibitPanel({ parent: document.body, onClose });
		panel.open(sample("contact"));
		const close = document.querySelector<HTMLButtonElement>(".exhibit-panel__close");
		expect(close).not.toBeNull();
		close?.click();
		expect(onClose).toHaveBeenCalledOnce();
		panel.close();
		expect(panel.isOpen()).toBe(false);
	});
});
