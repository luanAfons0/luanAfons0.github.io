import { EXHIBITS, type Exhibit, KIND_LABELS, partLabel } from "./content";
import "./exhibit-panel.css";

export interface ExhibitPanelOptions {
	/** The element the overlay goes into. */
	parent: HTMLElement;
	/** Runs when the player clicks Close. (The browser shell handles Esc.) */
	onClose(): void;
	/** The Content, for the Part labels. Defaults to the real Content. */
	content?: readonly Exhibit[];
}

export interface ExhibitPanel {
	/** Shows the full details of one Exhibit. */
	open(exhibit: Exhibit): void;
	close(): void;
	isOpen(): boolean;
}

/**
 * The Exhibit Panel: an HTML overlay above the canvas with the full details of one Exhibit, as real
 * text. One markup serves both Themes (exhibit-panel.css): a datasheet page in Paper, a board panel
 * in Board. It rises when it opens and closes at once.
 */
export function createExhibitPanel(options: ExhibitPanelOptions): ExhibitPanel {
	const content = options.content ?? EXHIBITS;
	const root = element("div", "exhibit-panel");
	root.hidden = true;
	root.setAttribute("role", "dialog");
	root.setAttribute("aria-modal", "true");
	root.setAttribute("aria-labelledby", "exhibit-panel-title");
	const panel = element("article", "exhibit-panel__panel");
	panel.tabIndex = -1;
	const body = element("div", "exhibit-panel__content");
	const close = element("button", "exhibit-panel__close");
	close.type = "button";
	close.textContent = "Close (Esc)";
	close.addEventListener("click", () => options.onClose());
	const foot = element("footer", "exhibit-panel__foot");
	foot.append(close);
	panel.append(body, foot);
	root.append(panel);
	options.parent.append(root);

	return {
		open(exhibit) {
			body.replaceChildren(...exhibitContent(exhibit, content));
			root.hidden = false;
			panel.scrollTop = 0;
			panel.focus();
		},
		close() {
			root.hidden = true;
		},
		isOpen: () => !root.hidden,
	};
}

function exhibitContent(exhibit: Exhibit, content: readonly Exhibit[]): HTMLElement[] {
	const header = element("header", "exhibit-panel__header");
	const part = element("span", "exhibit-panel__part", partLabel(content, exhibit));
	part.setAttribute("role", "img");
	part.setAttribute("aria-label", `${KIND_LABELS[exhibit.kind]} ${part.textContent}`);
	header.append(part, element("span", "exhibit-panel__kind", KIND_LABELS[exhibit.kind]));
	const title = element("h2", "exhibit-panel__title", exhibit.title);
	title.id = "exhibit-panel-title";

	const body = element("div", "exhibit-panel__body");
	body.append(title, element("p", "exhibit-panel__summary", exhibit.summary));
	if (exhibit.details.length > 0) {
		body.append(element("h3", "exhibit-panel__section", "Description"));
		for (const paragraph of exhibit.details) body.append(element("p", "exhibit-panel__details", paragraph));
	}
	if (exhibit.links.length > 0) {
		const list = element("ul", "exhibit-panel__links");
		for (const { label, url } of exhibit.links) {
			const link = element("a", "exhibit-panel__link", label);
			link.href = url;
			link.target = "_blank";
			link.rel = "noopener noreferrer";
			const item = element("li");
			item.append(link);
			list.append(item);
		}
		body.append(element("h3", "exhibit-panel__section", "Links"), list);
	}
	return [header, body];
}

function element<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	className?: string,
	text?: string,
): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	if (className) node.className = className;
	if (text !== undefined) node.textContent = text;
	return node;
}
