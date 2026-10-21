// The contact section: the copy buttons and the form check (mock lines 1008–1038).
import { track } from "../analytics/analytics";
import type { CopyKey } from "./copy";
import type { HomeContext } from "./home";

const COPIED_MS = 1600;

/** A link must start with http:// or https://, then a host with a dot (mock line 1030). */
const URL_RULE = /^https?:\/\/\S+\.\S+/;

/** An email has one @, then a host with a dot. */
const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldId = "name" | "email" | "url" | "msg";

/**
 * Starts the contact section: the `[data-copy]` buttons and the form. A valid form sends `form-ready`, then posts the
 * message to Web3Forms (the form `action`), which sends it to Luan's inbox.
 */
export function mountContact({ doc, win, signal, language }: HomeContext): void {
	const byId = <E extends HTMLElement>(id: string) => doc.getElementById(id) as E | null;

	// Copy buttons: the clipboard can refuse inside some viewers, so fall back to selecting the text.
	for (const button of doc.querySelectorAll<HTMLElement>("[data-copy]")) {
		button.addEventListener(
			"click",
			() => {
				const src = byId(button.dataset.copy ?? "");
				if (!src) return;
				// The clipboard can answer after dispose(): then nothing changes.
				const done = () => {
					if (signal.aborted) return;
					button.textContent = language.t("c.copied");
					const stop = () => win.clearTimeout(timer);
					const timer = win.setTimeout(() => {
						signal.removeEventListener("abort", stop);
						button.textContent = language.t("c.copy");
					}, COPIED_MS);
					signal.addEventListener("abort", stop, { once: true });
				};
				const select = () => {
					if (signal.aborted) return;
					const range = doc.createRange();
					range.selectNodeContents(src);
					const selection = win.getSelection();
					selection?.removeAllRanges();
					selection?.addRange(range);
				};
				try {
					win.navigator.clipboard.writeText(src.textContent ?? "").then(done, select);
				} catch {
					select();
				}
			},
			{ signal },
		);
	}

	// Contact form: checked here, then sent to the form service. With JavaScript off, the browser checks the
	// required fields and posts the form itself.
	const form = byId<HTMLFormElement>("form");
	const sent = byId("sent");
	const sentMsg = byId("sent-msg");
	const again = byId("again");
	const sendError = byId("e-send");
	if (!form || !sent || !sentMsg || !again || !sendError) return;
	form.noValidate = true;
	const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
	const buttonLabel = button?.querySelector<HTMLElement>("[data-t]");
	let sending = false;

	const value = (id: FieldId) => byId<HTMLInputElement | HTMLTextAreaElement>(`f-${id}`)?.value.trim() ?? "";

	/** Marks one field right or wrong, with its error under it. Returns true when it is right. */
	const check = (id: FieldId, bad: boolean, key: CopyKey): boolean => {
		const input = byId(`f-${id}`);
		const err = byId(`e-${id}`);
		input?.setAttribute("aria-invalid", String(bad));
		if (err) {
			err.hidden = !bad;
			err.textContent = bad ? language.t(key) : "";
		}
		return !bad;
	};

	form.addEventListener(
		"submit",
		(e) => {
			e.preventDefault();
			if (sending) return;
			const name = value("name");
			const email = value("email");
			const url = value("url");
			const msg = value("msg");
			const ok = [
				check("name", !name, "e.name"),
				check("email", !EMAIL_RULE.test(email), "e.email"),
				check("url", !!url && !URL_RULE.test(url), "e.url"),
				check("msg", !msg, "e.msg"),
			];
			const first = (["name", "email", "url", "msg"] as const)[ok.indexOf(false)];
			if (first) {
				byId(`f-${first}`)?.focus();
				return;
			}
			track("form-ready");
			void send(name);
		},
		{ signal },
	);

	/** Shows that the message is on its way, or not, on the submit button. */
	function setSending(on: boolean): void {
		sending = on;
		if (button) {
			button.disabled = on;
			button.setAttribute("aria-busy", String(on));
		}
		if (buttonLabel) buttonLabel.textContent = language.t(on ? "c.sending" : "c.send");
	}

	/**
	 * Posts the form fields. Success shows the sent state; a refusal or a network error shows the send error.
	 * The body is FormData with no Content-Type header, so the browser sends a simple request with no preflight.
	 */
	async function send(name: string): Promise<void> {
		if (!form || !sent || !sentMsg || !sendError) return;
		sendError.hidden = true;
		setSending(true);
		let done = false;
		try {
			const response = await win.fetch(form.action, {
				method: "POST",
				headers: { Accept: "application/json" },
				body: new win.FormData(form),
				signal,
			});
			const answer = (await response.json().catch(() => ({}))) as { success?: boolean };
			done = response.ok && answer.success === true;
		} catch {
			// A network error or dispose(): done stays false.
		}
		if (signal.aborted) return;
		setSending(false);
		if (!done) {
			sendError.textContent = language.t("e.send");
			sendError.hidden = false;
			return;
		}
		// A function replacer, so that a "$" in the name is not read as a replace pattern.
		const firstName = name.split(" ")[0] ?? "";
		sentMsg.textContent = language.t("c.sent").replace("{name}", () => firstName);
		form.hidden = true;
		sent.hidden = false;
	}

	again.addEventListener(
		"click",
		() => {
			form.reset();
			sendError.hidden = true;
			form.hidden = false;
			sent.hidden = true;
			byId("f-name")?.focus();
		},
		{ signal },
	);
}
