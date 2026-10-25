// The Demo stores section: one store card at a time, the store tiles under it, and the screen recordings
// (`.impeccable/mocks/ui-studio/demo-stores-a.html`).
import type { HomeContext } from "./home";

/** How long one store shows before the tiles move on by themselves: about one loop of its recording. */
const CYCLE_MS = 9000;

/**
 * Starts each `[data-showcase]`, in the page and in the Twin copy. With JavaScript off, the three cards stack and the
 * tiles stay hidden. A recording plays only while it is on screen, only in the shown card, and never with reduced
 * motion. The tiles move on by themselves while the section is in view, until the visitor picks a store or uses
 * the card.
 */
export function mountShowcase({ doc, win, signal }: HomeContext): void {
	const reduce = win.matchMedia("(prefers-reduced-motion: reduce)");
	for (const root of doc.querySelectorAll<HTMLElement>("[data-showcase]")) start(root);

	function start(root: HTMLElement): void {
		// The Twin copy keeps no tab stops (scroll.ts), so its tiles never take the focus.
		const inTwin = root.closest('[aria-hidden="true"]') !== null;
		const tablist = root.querySelector<HTMLElement>(".tabs");
		const panelsBox = root.querySelector<HTMLElement>(".panels");
		const tabs = [...root.querySelectorAll<HTMLButtonElement>(".tab")];
		const panels = [...root.querySelectorAll<HTMLElement>(".store")];
		const videos = [...root.querySelectorAll<HTMLVideoElement>("video[data-loop]")];
		if (!tablist || !panelsBox || tabs.length !== panels.length || !tabs.length) return;

		const visible = new Set<Element>();
		let current = 0;
		let auto = !reduce.matches;
		let inView = false;
		let timer = 0;

		function syncVideos(): void {
			for (const video of videos) {
				const on = !reduce.matches && visible.has(video) && video.closest(".store")?.classList.contains("is-on");
				if (on && video.paused) {
					video.preload = "auto";
					video.play()?.catch(() => {});
				} else if (!on && !video.paused) video.pause();
			}
		}

		/** Shows store `i`. A switch from the keyboard is instant and moves the focus to its tile. */
		function show(i: number, focus = false): void {
			current = (i + tabs.length) % tabs.length;
			panelsBox?.classList.toggle("is-instant", focus);
			tabs.forEach((tab, k) => {
				tab.setAttribute("aria-selected", String(k === current));
				if (!inTwin) tab.tabIndex = k === current ? 0 : -1;
			});
			panels.forEach((panel, k) => {
				panel.classList.toggle("is-on", k === current);
				panel.inert = k !== current;
			});
			for (const video of panels[current].querySelectorAll("video")) video.currentTime = 0;
			if (focus) tabs[current].focus();
			syncVideos();
			schedule();
		}

		/** Restarts the timer line of the shown tile, and the move to the next store. */
		function schedule(): void {
			win.clearTimeout(timer);
			tablist?.classList.remove("is-auto");
			if (!auto || !inView || doc.hidden || signal.aborted) return;
			void tablist?.offsetWidth;
			tablist?.classList.add("is-auto");
			timer = win.setTimeout(() => show(current + 1), CYCLE_MS);
		}

		function stopAuto(): void {
			auto = false;
			schedule();
		}

		tabs.forEach((tab, k) => {
			tab.addEventListener(
				"click",
				() => {
					stopAuto();
					show(k);
				},
				{ signal },
			);
			tab.addEventListener(
				"keydown",
				(e) => {
					const to = { ArrowRight: current + 1, ArrowLeft: current - 1, Home: 0, End: tabs.length - 1 }[e.key];
					if (to === undefined) return;
					e.preventDefault();
					stopAuto();
					show(to, true);
				},
				{ signal },
			);
		});
		root.addEventListener("pointerdown", stopAuto, { signal });
		root.addEventListener(
			"focusin",
			(e) => {
				if (!(e.target as Element).closest(".tab")) stopAuto();
			},
			{ signal },
		);
		doc.addEventListener("visibilitychange", schedule, { signal });
		reduce.addEventListener(
			"change",
			() => {
				if (reduce.matches) auto = false;
				schedule();
				syncVideos();
			},
			{ signal },
		);

		if ("IntersectionObserver" in win) {
			const videoObserver = new win.IntersectionObserver(
				(entries) => {
					for (const entry of entries) {
						if (entry.isIntersecting) visible.add(entry.target);
						else visible.delete(entry.target);
					}
					syncVideos();
				},
				{ threshold: 0.25 },
			);
			for (const video of videos) videoObserver.observe(video);
			const viewObserver = new win.IntersectionObserver(
				([entry]) => {
					inView = entry.isIntersecting;
					schedule();
				},
				{ threshold: 0.4 },
			);
			viewObserver.observe(root);
			signal.addEventListener(
				"abort",
				() => {
					videoObserver.disconnect();
					viewObserver.disconnect();
				},
				{ once: true },
			);
		}
		signal.addEventListener("abort", () => win.clearTimeout(timer), { once: true });

		tablist.hidden = false;
		show(0);
	}
}
