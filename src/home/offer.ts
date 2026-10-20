// The offer of the Home page: the prices of the Packages and of the Project builder items, and the Demo store prices.

/* MOCK VALUES: Luan sets the real prices. Whole currency units (mock lines 719–724). */

/** A price in each currency of the page. */
export interface Price {
	brl: number;
	usd: number;
}

/** A Package of the package table: Store fix, Store launch, or Care plan. */
export type PackageKey = "fix" | "launch" | "care";

/** An item of the Project builder: the 3 Packages and 4 more services. */
export type PickKey = PackageKey | "audit" | "import" | "section" | "lang2";

/** The price of each Project builder item. */
export const PRICES: Readonly<Record<PickKey, Price>> = {
	fix: { brl: 800, usd: 160 },
	launch: { brl: 4500, usd: 900 },
	care: { brl: 600, usd: 120 },
	audit: { brl: 0, usd: 0 },
	import: { brl: 500, usd: 100 },
	section: { brl: 900, usd: 180 },
	lang2: { brl: 700, usd: 140 },
};

/** The Project builder items, in the order of the switches. */
export const PICKS: readonly PickKey[] = ["launch", "fix", "care", "audit", "import", "section", "lang2"];

/** The items that are on when the page loads (mock line 1056). */
export const DEFAULT_PICKS: readonly PickKey[] = ["launch", "audit"];

/** A product of a Demo store. */
export type DemoProductKey = "coffee" | "coffee2" | "box" | "shirt" | "dress" | "tee";

/* MOCK VALUES: Demo store product prices, shown only inside the labelled demo screens (mock lines 725–729). */
export const DEMO_PRICES: Readonly<Record<DemoProductKey, Price>> = {
	coffee: { brl: 54.9, usd: 12 },
	coffee2: { brl: 64.9, usd: 15 },
	box: { brl: 119, usd: 28 },
	shirt: { brl: 189, usd: 46 },
	dress: { brl: 279, usd: 68 },
	tee: { brl: 89, usd: 22 },
};
