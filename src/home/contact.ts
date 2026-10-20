// The contact section: the copy buttons and the form check (mock lines 1116–1146).
import { track } from "../analytics/analytics";
import type { CopyKey } from "./copy";
import type { HomeContext } from "./home";

const COPIED_MS = 1600;

/** A link must start with http:// or https://, then a host with a dot (mock line 1138). */
const URL_RULE = /^https?:\/\/\S+\.\S+/;

type FieldId = "name" | "url" | "msg";

/** Starts the contact section: the `[data-copy]` buttons and the form, which sends `form-ready` when it is valid. */
export function mountContact({ doc, win, signal, language }: HomeContext): void {
	const byId = <E extends HTMLElement>(id: string) => doc.getElementById(id) as E | null;

	// Copy buttons: the clipboard can refuse inside some viewers, so fall back to selecting the text.
	for (const button of doc.querySelectorAll<HTMLElement>("[data-copy]")) {
		button.addEventListener(
			"click",
			() => {
				const src = byId(button.dataset.copy ?? "");
				if (!src) return;
				const done = () => {
					button.textContent = language.t("c.copied");
					win.setTimeout(() => {
						button.textContent = language.t("c.copy");
					}, COPIED_MS);
				};
				const select = () => {
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

	// Contact form: checked here; the form sends nothing.
	const form = byId<HTMLFormElement>("form");
	const sent = byId("sent");
	const sentMsg = byId("sent-msg");
	const again = byId("again");
	if (!form || !sent || !sentMsg || !again) return;

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
			const name = value("name");
			const url = value("url");
			const msg = value("msg");
			const ok = [
				check("name", !name, "e.name"),
				check("url", !!url && !URL_RULE.test(url), "e.url"),
				check("msg", !msg, "e.msg"),
			];
			const first = (["name", "url", "msg"] as const)[ok.indexOf(false)];
			if (first) {
				byId(`f-${first}`)?.focus();
				return;
			}
			sentMsg.textContent = language.t("c.sent").replace("{name}", name.split(" ")[0] ?? "");
			form.hidden = true;
			sent.hidden = false;
			track("form-ready");
		},
		{ signal },
	);

	again.addEventListener(
		"click",
		() => {
			form.reset();
			form.hidden = false;
			sent.hidden = true;
			byId("f-name")?.focus();
		},
		{ signal },
	);
}
