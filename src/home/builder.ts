// The Project builder: the switches, the Project list, and the Book a call link that puts the list in the message
// of the contact form (mock lines 966–1006).

import { locale } from "./format";
import type { HomeContext } from "./home";
import { DEFAULT_PICKS, PICKS, type PickKey } from "./offer";

/**
 * Starts the Project builder. It renders the switches and the Project list, calls `ctx.language.onChange` to render
 * again in a new language, and wires each `[data-prefill]` link (the Twin copy too) to fill the message of the form.
 */
export function mountBuilder({ doc, win, signal, language }: HomeContext): void {
	const selected = new Set<PickKey>(DEFAULT_PICKS);
	let shownItems = new Set(selected);
	const reduce = win.matchMedia("(prefers-reduced-motion: reduce)");
	const { t } = language;
	const all = <E extends Element = HTMLElement>(selector: string, root: ParentNode = doc) => [
		...root.querySelectorAll<E>(selector),
	];
	// The ids reach only the first copy, as in the mock: the Twin copy keeps its static builder.
	const picks = doc.getElementById("picks");
	const strip = doc.getElementById("strip");
	const lines = doc.getElementById("r-lines");
	const date = doc.getElementById("r-date");
	const msg = doc.getElementById("f-msg") as HTMLTextAreaElement | null;

	function renderPicks(): void {
		if (!picks) return;
		picks.innerHTML = PICKS.map(
			(k) => `
    <li class="pick"><label>
      <span><span class="pick-name">${t(`i.${k}`)}</span><span class="pick-desc">${t(`i.${k}.d`)}</span></span>
      <input class="switch" type="checkbox" role="switch" id="pick-${k}" data-pick="${k}" ${selected.has(k) ? "checked" : ""}>
    </label></li>`,
		).join("");
	}

	/** Each item that is on locks into the strip as one equal unit and gets one numbered line (mock lines 979–991). */
	function renderProject(animate: boolean): void {
		const items = PICKS.filter((k) => selected.has(k));
		const fresh = (k: PickKey) => (animate && !shownItems.has(k) && !reduce.matches ? " is-new" : "");
		if (strip) {
			strip.innerHTML = items.length
				? items.map((k, n) => `<span class="seg${fresh(k)}">${n + 1}</span>`).join("")
				: `<span class="strip-empty"></span>`;
		}
		if (lines) {
			lines.innerHTML = items.length
				? items.map((k, n) => `<li class="line${fresh(k)}"><i>${n + 1}</i><span>${t(`i.${k}`)}</span></li>`).join("")
				: `<li class="lines-empty">${t("r.empty")}</li>`;
		}
		// The note talks about the list, so it hides when the list is empty.
		for (const note of all(".est-note")) note.hidden = !items.length;
		shownItems = new Set(items);
	}

	picks?.addEventListener(
		"change",
		(e) => {
			const input = e.target;
			if (!(input instanceof win.HTMLInputElement) || !input.dataset.pick) return;
			const k = input.dataset.pick as PickKey;
			if (input.checked) selected.add(k);
			else selected.delete(k);
			renderProject(true);
		},
		{ signal },
	);

	/** The list that the builder put in the message last. */
	let lastFill = "";

	/**
	 * Puts "I am interested in:" and one line per item at the start of the message, then an empty line. A list that
	 * the builder put there before is replaced; text that the visitor wrote stays after it (mock lines 993–1006).
	 */
	function fillMessage(field: HTMLTextAreaElement): void {
		const items = PICKS.filter((k) => selected.has(k));
		const fill = items.length ? `${t("c.msgIntro")}\n${items.map((k) => `- ${t(`i.${k}`)}`).join("\n")}\n\n` : "";
		const own =
			lastFill && field.value.startsWith(lastFill)
				? field.value.slice(lastFill.length)
				: field.value === lastFill
					? ""
					: field.value;
		field.value = fill + own;
		lastFill = fill;
		// Browsers without field-sizing: content grow the field here, so the line after the list stays in view.
		if (!win.CSS?.supports?.("field-sizing", "content")) {
			field.style.height = "";
			field.style.height = `${field.scrollHeight + 2}px`;
		}
		field.classList.remove("is-filled");
		void field.offsetWidth;
		if (fill) field.classList.add("is-filled");
	}

	for (const link of all("[data-prefill]")) {
		link.addEventListener(
			"click",
			() => {
				if (!msg) return;
				fillMessage(msg);
				// The Virtual scroll moves the page to the form after this listener. Then the focus goes to the end
				// of the message.
				const timer = win.setTimeout(() => {
					signal.removeEventListener("abort", stop);
					msg.focus({ preventScroll: true });
					msg.setSelectionRange(msg.value.length, msg.value.length);
				});
				const stop = () => win.clearTimeout(timer);
				signal.addEventListener("abort", stop, { once: true });
			},
			{ signal },
		);
	}

	language.onChange((lang) => {
		if (date) {
			date.textContent = new Intl.DateTimeFormat(locale(lang), {
				day: "2-digit",
				month: "short",
				year: "numeric",
			}).format(new Date());
		}
		renderPicks();
		renderProject(false);
	});
}
