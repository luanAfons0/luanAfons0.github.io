// The Demo stores section: the screen recordings of the stores (`.impeccable/mocks/ui-studio/demo-stores-d.html`).
import type { HomeContext } from "./home";

/**
 * Starts the recordings of each `[data-showcase]`, in the page and in the Twin copy. A recording plays only while it
 * is on screen, and never with reduced motion. With JavaScript off, or with no IntersectionObserver, the posters show.
 */
export function mountShowcase({ doc, win, signal }: HomeContext): void {
	if (!("IntersectionObserver" in win)) return;
	const reduce = win.matchMedia("(prefers-reduced-motion: reduce)");
	const videos = [...doc.querySelectorAll<HTMLVideoElement>("[data-showcase] video[data-loop]")];
	const visible = new Set<Element>();

	function sync(): void {
		for (const video of videos) {
			const on = !reduce.matches && visible.has(video);
			if (on && video.paused) {
				video.preload = "auto";
				video.play()?.catch(() => {});
			} else if (!on && !video.paused) video.pause();
		}
	}

	const observer = new win.IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) visible.add(entry.target);
				else visible.delete(entry.target);
			}
			sync();
		},
		{ threshold: 0.25 },
	);
	for (const video of videos) observer.observe(video);
	reduce.addEventListener("change", sync, { signal });
	signal.addEventListener("abort", () => observer.disconnect(), { once: true });
}
