// The Page map under the nav: where the visitor is in the loop, with one tick per section (mock lines 1044–1053).
// It replaces the scrollbar that the Virtual scroll hides.
import type { HomeContext } from "./home";
import type { FrameHook } from "./scroll";

/** Starts the Page map. It moves `.map-fill` on each frame of `ctx.scroll` and puts one `.map-tick` per section. */
export function mountPageMap({ doc, scroll }: HomeContext): void {
	const map = doc.querySelector<HTMLElement>(".map");
	const fill = doc.querySelector<HTMLElement>(".map-fill");
	if (!map || !fill) throw new Error("mountPageMap needs a .map with a .map-fill");

	const hook: FrameHook = (m) => {
		fill.style.transform = `scaleX(${m / scroll.len()})`;
	};
	hook.measure = () => {
		for (const tick of map.querySelectorAll(".map-tick")) tick.remove();
		// Only the first copy has ids, and a hidden section has no offset parent.
		for (const section of doc.querySelectorAll<HTMLElement>("main section.section[id]")) {
			if (!section.offsetParent) continue;
			const tick = doc.createElement("span");
			tick.className = "map-tick";
			tick.style.left = `${(scroll.topOf(section) / scroll.len()) * 100}%`;
			map.append(tick);
		}
	};
	scroll.onFrame(hook);
}
