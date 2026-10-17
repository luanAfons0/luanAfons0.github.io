import { type AnalyticsEvent, track as sendEvent } from "../analytics/analytics";
import { loadSettings, saveSettings } from "../game/settings";
import { THEME_LABELS, THEMES, type Theme, shownTheme as themeOf } from "../game/theme";

export interface TitleScreenOptions<Game> {
	/** The document (or part of it) that holds the Title Screen markup from index.html. */
	root: ParentNode;
	/**
	 * Loads the game code, ready for the shown Theme. The Title Screen calls it at most once at a time,
	 * first on hover or focus of NEW GAME, and again after the visitor changes the Theme.
	 */
	loadGame(): Promise<Game>;
	/**
	 * Starts the game that loadGame() gave, after the Title Screen is hidden. When the game was ready
	 * before the click, it runs inside the click or key press (a user gesture). When it throws, the
	 * Title Screen shows again with the load error.
	 */
	startGame(game: Game): void;
	/**
	 * Runs at once inside the NEW GAME click or Enter key press: the user gesture that lets the page
	 * play sound. It runs once, before the game code is ready. When it throws, the game still starts.
	 */
	onNewGame?(): void;
	/** Sends an analytics event (`new-game`, `skip`, `theme/<id>`). By default it is the GoatCounter `track`. */
	track?(event: AnalyticsEvent): void;
	/** Opens a page: the Skip View. By default it is `location.assign`. */
	navigate?(url: string): void;
	/**
	 * Loads the page again: NEW GAME after a failed load does this, because a browser keeps a failed
	 * module import failed. By default it is `location.reload`.
	 */
	reload?(): void;
}

export interface TitleScreen {
	/** Removes the event listeners. */
	dispose(): void;
}

/** How long the dive may run before the game starts anyway: the longest transition (460 ms, Dungeon) plus a margin. */
const DIVE_FALLBACK_MS = 600;

/** The Dungeon loading die: the faces it shows, in order, one each step, like a roll. */
const DIE_FACES = ["3", "6", "1", "5", "2", "4"] as const;
const DIE_STEP_MS = 140;

/** The menu keys. The arrow keys move the selection (and wrap); Enter chooses the selected item. */
const MOVES: Record<string, number> = { ArrowUp: -1, ArrowDown: 1 };

/**
 * The Title Screen: NEW GAME, SKIP, or Theme. It loads the game code only when the visitor points at or
 * focuses NEW GAME. The Theme item cycles through the Themes (Paper, Board, Dungeon) at once and saves the choice.
 */
export function createTitleScreen<Game>(options: TitleScreenOptions<Game>): TitleScreen {
	const track = options.track ?? sendEvent;
	const navigate = options.navigate ?? ((url: string) => location.assign(url));
	const reload = options.reload ?? (() => location.reload());
	const newGame = query<HTMLElement>(options.root, '[data-menu-item="new-game"]');
	const skip = query<HTMLAnchorElement>(options.root, '[data-menu-item="skip"]');
	const themeItem = query<HTMLElement>(options.root, '[data-menu-item="theme"]');
	const themeName = query<HTMLElement>(options.root, "[data-theme-name]");
	const items: readonly HTMLElement[] = [newGame, skip, themeItem];
	const screen = query<HTMLElement>(options.root, "[data-title-screen]");
	const loadingBar = query<HTMLElement>(options.root, "[data-loading-bar]");
	const loadError = query<HTMLElement>(options.root, "[data-load-error]");
	const chip = options.root.querySelector<HTMLElement>("[data-chip]");
	const plate = options.root.querySelector<HTMLElement>("[data-ink-plate]");
	const die = options.root.querySelector<HTMLElement>("[data-die]");
	const dive = query<HTMLElement>(options.root, "[data-dive]");
	const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
	const loadErrorText = query<HTMLElement>(options.root, "[data-load-error-text]");

	// The loader: idle (no promise), loading, ready (`loaded` is set), or failed (`loadFailed` is set once NEW GAME shows it).
	let loading: Promise<Game> | undefined;
	let loaded: { game: Game } | undefined;
	const preload = (): Promise<Game> => {
		if (loading) return loading;
		const attempt: Promise<Game> = options.loadGame().then((game) => {
			// A load from before a Theme change has the art of the old Theme: only the latest load counts.
			if (loading === attempt) loaded = { game };
			return game;
		});
		loading = attempt;
		return attempt;
	};
	// A hover that fails to load the game shows nothing yet: NEW GAME shows the error.
	const preloadQuietly = () => {
		preload().catch(() => {});
	};

	/**
	 * The loading state. In Dungeon its die steps to a new face every 140 ms while it shows; under
	 * reduced motion the die stays still.
	 */
	let rolling: ReturnType<typeof setInterval> | undefined;
	const showLoading = () => {
		loadingBar.hidden = false;
		if (!die || rolling !== undefined || reducedMotion.matches) return;
		let step = 0;
		rolling = setInterval(() => {
			die.dataset.face = DIE_FACES[step++ % DIE_FACES.length];
		}, DIE_STEP_MS);
	};
	const hideLoading = () => {
		loadingBar.hidden = true;
		clearInterval(rolling);
		rolling = undefined;
	};

	let starting = false;
	let loadFailed = false;
	/** Shows the error on the Title Screen. NEW GAME then reloads the page; SKIP still works. */
	const fail = (error: unknown) => {
		console.error(error);
		starting = false;
		themeItem.removeAttribute("aria-disabled");
		loadFailed = true;
		hideDive();
		screen.hidden = false;
		hideLoading();
		loadErrorText.textContent =
			"The game could not load. Check your connection, then choose NEW GAME to reload the page. Or choose SKIP.";
		loadError.hidden = false;
	};
	const hideDive = () => {
		dive.hidden = true;
		dive.classList.remove("is-open");
	};
	/**
	 * Grows the dive layer from `from` (see `diveFrom`) to the full screen. It resolves on the transition end, or after the fallback timeout when that never comes
	 * (a hidden tab does not run frames).
	 */
	const runDive = (from: HTMLElement) =>
		new Promise<void>((resolve) => {
			const rect = from.getBoundingClientRect();
			const root = dive.ownerDocument.documentElement;
			dive.style.setProperty("--dive-top", `${rect.top}px`);
			dive.style.setProperty("--dive-right", `${root.clientWidth - rect.right}px`);
			dive.style.setProperty("--dive-bottom", `${root.clientHeight - rect.bottom}px`);
			dive.style.setProperty("--dive-left", `${rect.left}px`);
			dive.classList.remove("is-open");
			dive.hidden = false;
			// Two frames: the first paints the small clip, the second starts the transition.
			requestAnimationFrame(() => requestAnimationFrame(() => dive.classList.add("is-open")));
			const finish = () => {
				clearTimeout(timer);
				dive.removeEventListener("transitionend", finish);
				resolve();
			};
			const timer = setTimeout(finish, DIVE_FALLBACK_MS);
			dive.addEventListener("transitionend", finish);
		});
	const start = (game: Game) => {
		hideDive();
		hideLoading();
		screen.hidden = true;
		try {
			options.startGame(game);
		} catch (error) {
			return fail(error);
		}
		// The game has the keys now. On a failed start, the Title Screen keeps them.
		dispose();
	};
	const startNewGame = () => {
		if (starting) return;
		starting = true;
		if (loadFailed) return reload();
		// The game starts with the art of the shown Theme, so the Theme stays until it starts or fails.
		themeItem.setAttribute("aria-disabled", "true");
		track("new-game");
		try {
			options.onNewGame?.();
		} catch (error) {
			// The hook only starts extras (the sound). The game starts without them.
			console.error(error);
		}
		const pending = preload();
		const from = diveFrom[shownTheme()];
		if (!reducedMotion.matches && from) {
			// The game starts when the dive ends, or at once if the game is not ready yet: then the bar shows.
			pending.catch(fail);
			void runDive(from).then(() => {
				if (loadFailed) return;
				if (loaded) return start(loaded.game);
				hideDive();
				showLoading();
				pending.then(start, () => {});
			});
			return;
		}
		if (loaded) return start(loaded.game);
		showLoading();
		pending.then(start, fail);
	};

	// The selected item has the cursor. Like a 1990s shooter menu, the mouse and the focus move it too.
	let selected = 0;
	const select = (index: number) => {
		selected = index;
		items.forEach((item, i) => {
			item.classList.toggle("is-selected", i === index);
		});
	};

	// The Theme: data-theme on the root, set by the Theme head script from the saved settings. With no
	// data-theme, the CSS follows the system setting, so the label follows it too.
	const page = themeItem.ownerDocument.documentElement;
	const darkSystem = matchMedia("(prefers-color-scheme: dark)");
	/** Where the dive grows from in each look: the chip, the selected pad, or the ink plate. */
	const diveFrom: Record<Theme, HTMLElement | null> = {
		paper: chip,
		board: newGame.querySelector<HTMLElement>(".title-screen__pad"),
		dungeon: plate,
	};
	const shownTheme = () => themeOf(page, darkSystem);
	const showThemeName = () => {
		themeName.textContent = THEME_LABELS[shownTheme()];
	};
	showThemeName();
	/**
	 * Switches to the next Theme (in `THEMES` order, wrapping) at once and saves it. The Theme item
	 * keeps the selection and the focus. The game loaded so far has the art of the old Theme, so the
	 * next hover, focus, or NEW GAME loads it again. After NEW GAME, until the game starts or fails to
	 * load, it does nothing: the game and the Audio start with the art of the Theme NEW GAME saw.
	 */
	const switchTheme = () => {
		if (starting) return;
		const theme = THEMES[(THEMES.indexOf(shownTheme()) + 1) % THEMES.length] as Theme;
		page.dataset.theme = theme;
		saveSettings({ ...loadSettings(), theme });
		showThemeName();
		track(`theme/${theme}`);
		loading = undefined;
		loaded = undefined;
	};

	const choose = () => {
		const item = items[selected];
		if (item === skip) {
			track("skip");
			navigate(skip.href);
		} else if (item === themeItem) switchTheme();
		else startNewGame();
	};

	const onKeyDown = (event: KeyboardEvent) => {
		const move = MOVES[event.code];
		if (move !== undefined) {
			event.preventDefault();
			const next = (selected + move + items.length) % items.length;
			select(next);
			items[next]?.focus();
		} else if (event.code === "Enter" || event.code === "NumpadEnter") {
			event.preventDefault();
			choose();
		}
	};

	const listeners = items.map((item, index) => {
		const onPoint = () => select(index);
		item.addEventListener("pointerenter", onPoint);
		item.addEventListener("focus", onPoint);
		return () => {
			item.removeEventListener("pointerenter", onPoint);
			item.removeEventListener("focus", onPoint);
		};
	});
	newGame.addEventListener("pointerenter", preloadQuietly);
	newGame.addEventListener("focus", preloadQuietly);
	newGame.addEventListener("click", startNewGame);
	themeItem.addEventListener("click", switchTheme);
	darkSystem.addEventListener("change", showThemeName);
	// A click on the SKIP link follows the link by itself; the Enter key goes through choose().
	const onSkipClick = () => track("skip");
	skip.addEventListener("click", onSkipClick);
	document.addEventListener("keydown", onKeyDown);

	function dispose(): void {
		clearInterval(rolling);
		for (const remove of listeners) remove();
		newGame.removeEventListener("pointerenter", preloadQuietly);
		newGame.removeEventListener("focus", preloadQuietly);
		newGame.removeEventListener("click", startNewGame);
		themeItem.removeEventListener("click", switchTheme);
		darkSystem.removeEventListener("change", showThemeName);
		skip.removeEventListener("click", onSkipClick);
		document.removeEventListener("keydown", onKeyDown);
	}

	return { dispose };
}

function query<T extends Element>(root: ParentNode, selector: string): T {
	const element = root.querySelector<T>(selector);
	if (!element) throw new Error(`The Title Screen has no ${selector}.`);
	return element;
}
