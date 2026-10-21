// Money and dates in the language of the page (mock line 882).
import type { Lang } from "./copy";
import type { Price } from "./offer";

/** The Intl locale of a language. */
export function locale(lang: Lang): string {
	return lang === "pt" ? "pt-BR" : "en-US";
}

/** The amount of `price` in the currency of `lang`: BRL for Portuguese, USD for English. */
export function inCurrency(lang: Lang, price: Price): number {
	return lang === "pt" ? price.brl : price.usd;
}

/** Formats `value` as money in the currency of `lang`, with 2 decimals when `cents` is true, else none. */
export function fmt(lang: Lang, value: number, cents = false): string {
	const digits = cents ? 2 : 0;
	return new Intl.NumberFormat(locale(lang), {
		style: "currency",
		currency: lang === "pt" ? "BRL" : "USD",
		minimumFractionDigits: digits,
		maximumFractionDigits: digits,
	}).format(value);
}
