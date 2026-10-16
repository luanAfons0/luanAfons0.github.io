// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { EXHIBITS } from "./content";
import { createExhibitPanel } from "./exhibit-panel";

describe("Exhibit Panel", () => {
	it("shows the Part label and the kind in its header", () => {
		const panel = createExhibitPanel({ parent: document.body, onClose: () => {} });
		const project = EXHIBITS.find((e) => e.kind === "project");
		if (!project) throw new Error("no sample project");
		panel.open(project);
		const header = document.querySelector(".exhibit-panel__header")?.textContent ?? "";
		expect(header).toContain("U1");
		expect(header).toContain("Project");
	});
});
