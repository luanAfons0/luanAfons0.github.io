import "./resume-prompt.css";

export interface ResumePromptOptions {
	/** The element the overlay goes into. */
	parent: HTMLElement;
	/** Runs on a click (or Enter or Space) on the prompt: a user gesture, so the page can capture the mouse. */
	onResume(): void;
}

export interface ResumePrompt {
	open(): void;
	close(): void;
	isOpen(): boolean;
}

/**
 * The "Click to resume" state: one big button over the paused game. The browser never treats Esc
 * as a user gesture, so after Esc closes the Exhibit Panel the page cannot capture the mouse. The
 * click on this button can, and it resumes the game. It does not count as a shot: the button
 * takes the click before the mouse is captured. It is drawn on the board in both Themes.
 */
export function createResumePrompt(options: ResumePromptOptions): ResumePrompt {
	const button = document.createElement("button");
	button.type = "button";
	button.className = "resume-prompt";
	button.hidden = true;
	// The label sits in a span: the button covers the whole screen, the span draws the outline.
	const label = document.createElement("span");
	label.className = "resume-prompt__label";
	label.textContent = "Click to resume";
	button.append(label);
	button.addEventListener("click", () => options.onResume());
	options.parent.append(button);

	return {
		open() {
			button.hidden = false;
			button.focus();
		},
		close() {
			button.hidden = true;
		},
		isOpen: () => !button.hidden,
	};
}
