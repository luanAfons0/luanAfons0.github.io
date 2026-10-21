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
export type DemoProductKey = "coffee" | "coffee2" | "box" | "shirt" | "dress" | "tee";

/* MOCK VALUES: Demo store product prices, shown only inside the labelled demo screens (mock lines 661–665). */
export const DEMO_PRICES: Readonly<Record<DemoProductKey, Price>> = {
	coffee: { brl: 54.9, usd: 12 },
	coffee2: { brl: 64.9, usd: 15 },
	box: { brl: 119, usd: 28 },
	shirt: { brl: 189, usd: 46 },
	dress: { brl: 279, usd: 68 },
	tee: { brl: 89, usd: 22 },
};
