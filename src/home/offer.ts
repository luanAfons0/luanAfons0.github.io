// The offer of the Home page: the Project builder items and the Demo store prices.

/** A price in each currency of the page. */
export interface Price {
	brl: number;
	usd: number;
}

/** An item of the Project builder. */
export type PickKey = "launch" | "fix" | "care" | "audit" | "import" | "section" | "lang2";

/** The Project builder items, in the order of the switches. */
export const PICKS: readonly PickKey[] = ["launch", "fix", "care", "audit", "import", "section", "lang2"];

/** The items that are on when the page loads (mock line 967). */
export const DEFAULT_PICKS: readonly PickKey[] = ["launch", "audit"];

/** A product of a Demo store. */
export type DemoProductKey = "coffee";

/* The Demo store product price of the Filmstrip, shown only inside its labelled demo Frame (mock lines 661–665). */
export const DEMO_PRICES: Readonly<Record<DemoProductKey, Price>> = {
	coffee: { brl: 54.9, usd: 12 },
};
