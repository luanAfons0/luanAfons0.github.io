// The Filmstrip: the active Frame, the Timeline and the Chapters (mock lines 1005–1042 and 1149–1150).
import type { HomeContext } from "./home";

/**
 * Starts the Filmstrip. With the Virtual scroll it picks the Frame at the middle of the view on each frame of
 * `ctx.scroll`; on phones and with reduced motion, the swipe row picks it.
 */
export function mountFilmstrip({ doc, win, signal, scroll }: HomeContext): void {
	// The id finds only the first copy: the Twin copy keeps the Frames that it had when it was made.
	const found = doc.querySelector<HTMLElement>("#services");
	if (!found) throw new Error("mountFilmstrip needs a #services element");
	const fs: HTMLElement = found;
	const frames = [...fs.querySelectorAll<HTMLElement>(".frame")];
	const chapters = [...fs.querySelectorAll<HTMLElement>(".chapter")];
	const stops = [...fs.querySelectorAll<HTMLElement>(".fs-stop")];
	const ticks = [...fs.querySelectorAll<HTMLElement>(".tl-tick")];
	const fan = fs.querySelector<HTMLElement>(".fan");
	const rowMode = win.matchMedia("(max-width: 767px), (prefers-reduced-motion: reduce)");
	let active = -1;
	let observer: IntersectionObserver | null = null;

	/** Fans the Frames around Frame `i`. `instant` jumps there with no transition. */
	function setActive(i: number, instant = false) {
		if (i === active) return;
		active = i;
		if (instant) fs.classList.add("is-jump");
		frames.forEach((frame, k) => {
			const d = k - i;
			frame.style.setProperty("--d", String(d));
			frame.style.setProperty("--ad", String(Math.abs(d)));
			frame.style.zIndex = String(10 - Math.abs(d));
			frame.classList.toggle("is-active", d === 0);
		});
		chapters.forEach((chapter, k) => {
			chapter.classList.toggle("is-active", k === i);
		});
		ticks.forEach((tick, k) => {
			tick.classList.toggle("is-active", k === i);
			tick.classList.toggle("is-done", k < i);
		});
		if (instant) {
			// Read the layout, so that the browser draws the jump before the transitions come back.
			void fs.offsetWidth;
			fs.classList.remove("is-jump");
		}
	}

	// In the swipe row, the Frame that shows most of itself is the active Frame.
	function observe() {
		observer?.disconnect();
		observer = null;
		if (!rowMode.matches || signal.aborted) return;
		observer = new win.IntersectionObserver(
			(entries) => {
				for (const entry of entries) if (entry.isIntersecting) setActive(frames.indexOf(entry.target as HTMLElement));
			},
			{ root: fan, threshold: 0.6 },
		);
		for (const frame of frames) observer.observe(frame);
	}

	// The stop under the reading line picks the Frame. Out of view, the strip waits on the Frame that it shows first:
	// the first one when the page comes round from the top, the last one when it comes back from below.
	scroll.onFrame((m) => {
		if (rowMode.matches) return;
		const h = win.innerHeight;
		const top = scroll.topOf(fs);
		const line = m + h * 0.75;
		if (top + fs.offsetHeight < m || top > m + h) return setActive(scroll.dir() > 0 ? 0 : frames.length - 1, true);
		const step = stops[1].offsetTop - stops[0].offsetTop;
		setActive(Math.max(0, Math.min(frames.length - 1, Math.floor((line - top - h * 0.5) / step))));
	});

	rowMode.addEventListener("change", observe, { signal });
	signal.addEventListener("abort", () => observer?.disconnect(), { once: true });

	observe();
	setActive(0);
}
