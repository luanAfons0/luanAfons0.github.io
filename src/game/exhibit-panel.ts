import { EXHIBITS, type Exhibit, KIND_LABELS, partLabel } from "./content";

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

/** The Exhibit Panel: an HTML overlay above the canvas with the full details of one Exhibit, as real text. */
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
	panel.append(body, close);
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
	const poster = element("img", "exhibit-panel__poster");
	poster.src = `${import.meta.env.BASE_URL}${exhibit.poster}`;
	poster.alt = "";
	const kind = element("p", "exhibit-panel__kind");
	kind.append(element("span", "exhibit-panel__part", partLabel(content, exhibit)), ` ${KIND_LABELS[exhibit.kind]}`);
	const title = element("h2", "exhibit-panel__title", exhibit.title);
	title.id = "exhibit-panel-title";
	const header = element("header", "exhibit-panel__header");
	const heading = element("div");
	heading.append(kind, title);
	header.append(poster, heading);

	const parts: HTMLElement[] = [header, element("p", "exhibit-panel__summary", exhibit.summary)];
	for (const paragraph of exhibit.details) parts.push(element("p", "exhibit-panel__details", paragraph));
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
		parts.push(list);
	}
	return parts;
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
