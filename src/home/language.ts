// The language of the Home page: English (USD) or Portuguese (BRL). It restores and saves the choice,
// wires the EN/PT toggle, and puts every translated text, label, placeholder, link and Demo store price on the page
// (mock lines 765–767 and 884–914).
import { track } from "../analytics/analytics";
import { type CopyKey, LANGS, type Lang, STORAGE_KEY, translate } from "./copy";
import { fmt, inCurrency, locale } from "./format";
import { DEMO_PRICES, type DemoProductKey } from "./offer";

export interface Language {
	/** The language that the page shows now. */
	current(): Lang;
	/** The text of `key` in the current language. */
	t(key: CopyKey): string;
	/** Adds `fn` to the end of every `apply()`. The functions run in the order that they were added. */
	onChange(fn: (lang: Lang) => void): void;
	/** Puts the current language on the whole page, then runs each `onChange` function (the mock's `applyLang`). */
	apply(): void;
}

function isLang(value: unknown): value is Lang {
	return (LANGS as readonly unknown[]).includes(value);
}

/** The saved language, or English. A storage that throws (blocked, private mode) gives English. */
function restore(win: Window): Lang {
	try {
		const saved = win.localStorage.getItem(STORAGE_KEY);
		if (isLang(saved)) return saved;
	} catch {
		// No storage: the page starts in English.
	}
	return "en";
}

function save(win: Window, lang: Lang): void {
	try {
		win.localStorage.setItem(STORAGE_KEY, lang);
	} catch {
		// No storage: the choice lasts until the page closes.
	}
}

/** The next 3 weekdays after `from`, with no Saturday or Sunday (mock line 910). */
function nextWeekdays(from: Date): Date[] {
	const days: Date[] = [];
	const d = new Date(from);
	while (days.length < 3) {
		d.setDate(d.getDate() + 1);
		if (d.getDay() % 6) days.push(new Date(d));
	}
	return days;
}

/** Creates the language of the page, restored from storage, and wires the EN/PT toggle. It does not apply it. */
export function createLanguage(doc: Document, signal: AbortSignal): Language {
	const win = doc.defaultView;
	if (!win) throw new Error("createLanguage needs a document with a window");
	const subscribers: ((lang: Lang) => void)[] = [];
	let lang = restore(win);

	const t = (key: CopyKey | string) => translate(lang, key);
	const all = <E extends Element = HTMLElement>(selector: string) => [...doc.querySelectorAll<E>(selector)];

	/** The booking Frame shows the next 3 weekdays, in the language of the page (mock lines 907–914). */
	function renderDays(): void {
		const weekday = new Intl.DateTimeFormat(locale(lang), { weekday: "short" });
		const html = nextWeekdays(new Date())
			.map(
				(day, k) =>
					`<span class="day${k === 1 ? " on" : ""}"><small>${weekday.format(day).replace(".", "")}</small><b>${day.getDate()}</b></span>`,
			)
			.join("");
		for (const el of all(".days")) el.innerHTML = html;
	}

	function apply(): void {
		doc.documentElement.lang = lang === "pt" ? "pt-BR" : "en";
		for (const el of all("[data-t]")) {
			const s = t(el.dataset.t ?? "");
			if (!s.includes("{key}")) {
				el.textContent = s;
				continue;
			}
			const [before, after] = s.split("{key}");
			const key = Object.assign(doc.createElement("span"), { className: "key", textContent: t("pr.key") });
			el.replaceChildren(before, key, after);
		}
		for (const el of all("[data-t-aria]")) el.setAttribute("aria-label", t(el.dataset.tAria ?? ""));
		for (const el of all("[data-t-ph]")) el.setAttribute("placeholder", t(el.dataset.tPh ?? ""));
		for (const el of all("[data-t-href]")) el.setAttribute("href", t(el.dataset.tHref ?? ""));
		for (const el of all("[data-demo-price]")) {
			el.textContent = fmt(lang, inCurrency(lang, DEMO_PRICES[el.dataset.demoPrice as DemoProductKey]), lang === "pt");
		}
		for (const b of all(".lang button")) b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
		renderDays();
		for (const fn of subscribers) fn(lang);
	}

	for (const button of all<HTMLButtonElement>(".lang button")) {
		button.addEventListener(
			"click",
			() => {
				const next = button.dataset.lang;
				if (!isLang(next)) return;
				const changed = next !== lang;
				lang = next;
				save(win, lang);
				apply();
				if (changed) track(`lang/${lang}`);
			},
			{ signal },
		);
	}

	return {
		current: () => lang,
		t,
		onChange: (fn) => {
			subscribers.push(fn);
		},
		apply,
	};
}
