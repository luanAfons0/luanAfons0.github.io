// Money and dates in the language of the page (mock lines 967–969).
import type { Lang } from "./copy";
import { type PickKey, PRICES, type Price } from "./offer";

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

/** The price of a Project builder item in the currency of `lang`. */
export function price(lang: Lang, key: PickKey): number {
	return inCurrency(lang, PRICES[key]);
}

/** The price of a Project builder item as money, for example "$900" or "R$ 4.500". */
export function money(lang: Lang, key: PickKey): string {
	return fmt(lang, price(lang, key));
}
