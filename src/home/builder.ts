// The Project builder: the switches, the "Add to project" buttons of the package table, and the Project estimate
// (mock lines 985 and 1055–1114).
import { track } from "../analytics/analytics";
import { fmt, locale, money, price } from "./format";
import type { HomeContext } from "./home";
import { DEFAULT_PICKS, type PackageKey, PICKS, type PickKey } from "./offer";

const DIGITS = [..."0123456789"].map((n) => `<span>${n}</span>`).join("");

/**
 * Starts the Project builder. It renders the switches and the Project estimate, wires every `[data-add]` button
 * (the Twin copy too), sends `add/<package>`, and calls `ctx.language.onChange` to render again in a new language.
 */
export function mountBuilder({ doc, win, signal, language }: HomeContext): void {
	const selected = new Set<PickKey>(DEFAULT_PICKS);
	let shownItems = new Set(selected);
	const reduce = win.matchMedia("(prefers-reduced-motion: reduce)");
	const { t } = language;
	const cost = (k: PickKey) => price(language.current(), k);
	const all = <E extends Element = HTMLElement>(selector: string, root: ParentNode = doc) => [
		...root.querySelectorAll<E>(selector),
	];
	// The ids reach only the first copy, as in the mock: the Twin copy keeps its static builder.
	const picks = doc.getElementById("picks");
	const strip = doc.getElementById("strip");
	const lines = doc.getElementById("r-lines");
	const total = doc.getElementById("r-total");
	const date = doc.getElementById("r-date");

	function syncAddButton(b: HTMLElement): void {
		const on = selected.has(b.dataset.add as PickKey);
		b.setAttribute("aria-pressed", String(on));
		b.querySelector("use")?.setAttribute("href", on ? "#i-check" : "#i-plus");
		const label = b.querySelector("span");
		if (label) label.textContent = t(on ? "pk.added" : "pk.add");
	}

	function syncAddButtons(k?: PickKey): void {
		for (const b of all(k ? `[data-add="${k}"]` : "[data-add]")) syncAddButton(b);
	}

	function renderPicks(): void {
		if (!picks) return;
		picks.innerHTML = PICKS.map(
			(k) => `
    <li class="pick"><label>
      <span><span class="pick-name">${t(`i.${k}`)}</span><span class="pick-desc">${t(`i.${k}.d`)}</span></span>
      <span class="pick-price">${cost(k) === 0 ? t("free") : `+${money(language.current(), k)}`}</span>
      <input class="switch" type="checkbox" role="switch" id="pick-${k}" data-pick="${k}" ${selected.has(k) ? "checked" : ""}>
    </label></li>`,
		).join("");
	}

	/** Each item that is on locks into the strip as one unit and gets one numbered line (mock lines 1071–1083). */
	function renderProject(animate: boolean): void {
		const items = PICKS.filter((k) => selected.has(k));
		const unit = cost("import") * 0.6;
		const fresh = (k: PickKey) => (animate && !shownItems.has(k) && !reduce.matches ? " is-new" : "");
		if (strip) {
			strip.innerHTML = items.length
				? items
						.map(
							(k, n) =>
								`<span class="seg${cost(k) === 0 ? " free" : ""}${fresh(k)}" style="--g:${Math.max(cost(k), unit)}">${n + 1}</span>`,
						)
						.join("")
				: `<span class="strip-empty"></span>`;
		}
		if (lines) {
			lines.innerHTML = items.length
				? items
						.map(
							(k, n) =>
								`<li class="line"><i>${n + 1}</i><span>${t(`i.${k}`)}</span><span class="v">${cost(k) === 0 ? t("r.free") : money(language.current(), k)}</span></li>`,
						)
						.join("")
				: `<li class="lines-empty">${t("r.empty")}</li>`;
		}
		shownItems = new Set(items);
		if (total)
			setOdometer(
				total,
				fmt(
					language.current(),
					items.reduce((sum, k) => sum + cost(k), 0),
				),
			);
	}

	/**
	 * Shows `str` on the odometer and announces it. The digit columns are built again only when the shape changes:
	 * new columns start from the old digits, right-aligned, so the total rolls from the last one (mock lines 1084–1101).
	 */
	function setOdometer(el: HTMLElement, str: string): void {
		const shape = str.replace(/\d/g, "0");
		el.setAttribute("aria-label", str);
		const digits = str.replace(/\D/g, "");
		const fill = () => {
			el.dataset.digits = digits;
			all<HTMLElement>(".roll-col", el).forEach((col, k) => {
				col.style.setProperty("--v", digits[k] ?? "0");
			});
		};
		if (el.dataset.shape === shape) {
			fill();
			return;
		}
		el.dataset.shape = shape;
		const prev = [...(el.dataset.digits ?? "")];
		let k = 0;
		el.innerHTML = [...str]
			.map((c) => {
				if (!/\d/.test(c)) return `<span aria-hidden="true">${c}</span>`;
				const from = prev[prev.length - (digits.length - k++)] ?? 0;
				return `<span class="roll" aria-hidden="true"><span class="roll-col" style="--v:${from}">${DIGITS}</span></span>`;
			})
			.join("");
		// Two frames, so that the browser paints the old digits before the roll starts.
		win.requestAnimationFrame(() =>
			win.requestAnimationFrame(() => {
				if (!signal.aborted) fill();
			}),
		);
	}

	picks?.addEventListener(
		"change",
		(e) => {
			const input = e.target;
			if (!(input instanceof win.HTMLInputElement) || !input.dataset.pick) return;
			const k = input.dataset.pick as PickKey;
			if (input.checked) selected.add(k);
			else selected.delete(k);
			syncAddButtons(k);
			renderProject(true);
		},
		{ signal },
	);

	for (const b of all("[data-add]")) {
		b.addEventListener(
			"click",
			() => {
				const k = b.dataset.add as PackageKey;
				const adding = !selected.has(k);
				if (adding) selected.add(k);
				else selected.delete(k);
				syncAddButtons(k);
				renderPicks();
				renderProject(true);
				if (adding) track(`add/${k}`);
			},
			{ signal },
		);
	}

	language.onChange((lang) => {
		syncAddButtons();
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
