import { type AnalyticsEvent, track as sendEvent } from "../analytics/analytics";

export interface TitleScreenOptions<Game> {
	/** The document (or part of it) that holds the Title Screen markup from index.html. */
	root: ParentNode;
	/** Loads the game code. The Title Screen calls it at most once at a time, first on hover or focus of NEW GAME. */
	loadGame(): Promise<Game>;
	/**
	 * Starts the game that loadGame() gave, after the Title Screen is hidden. When the game was ready
	 * before the click, it runs inside the click or key press (a user gesture).
	 */
	startGame(game: Game): void;
	/**
	 * Runs at once inside the NEW GAME click or Enter key press: the user gesture that lets the page
	 * play sound. It runs once, before the game code is ready.
	 */
	onNewGame?(): void;
	/** Sends an analytics event (`new-game`, `skip`). By default it is the GoatCounter `track`. */
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

/** The menu keys. The arrow keys move the selection (and wrap); Enter chooses the selected item. */
const MOVES: Record<string, number> = { ArrowUp: -1, ArrowDown: 1 };

/** The Title Screen: NEW GAME or SKIP. It loads the game code only when the visitor points at or focuses NEW GAME. */
export function createTitleScreen<Game>(options: TitleScreenOptions<Game>): TitleScreen {
	const track = options.track ?? sendEvent;
	const navigate = options.navigate ?? ((url: string) => location.assign(url));
	const reload = options.reload ?? (() => location.reload());
	const newGame = query<HTMLElement>(options.root, '[data-menu-item="new-game"]');
	const skip = query<HTMLAnchorElement>(options.root, '[data-menu-item="skip"]');
	const items: readonly HTMLElement[] = [newGame, skip];
	const screen = query<HTMLElement>(options.root, "[data-title-screen]");
	const loadingBar = query<HTMLElement>(options.root, "[data-loading-bar]");
	const loadError = query<HTMLElement>(options.root, "[data-load-error]");

	// The loader: idle (no promise), loading, ready (`loaded` is set), or failed (`loadFailed` is set once NEW GAME shows it).
	let loading: Promise<Game> | undefined;
	let loaded: { game: Game } | undefined;
	const preload = (): Promise<Game> => {
		loading ??= options.loadGame().then((game) => {
			loaded = { game };
			return game;
		});
		return loading;
	};
	// A hover that fails to load the game shows nothing yet: NEW GAME shows the error.
	const preloadQuietly = () => {
		preload().catch(() => {});
	};

	let starting = false;
	let loadFailed = false;
	const start = (game: Game) => {
		dispose();
		loadingBar.hidden = true;
		screen.hidden = true;
		options.startGame(game);
	};
	const startNewGame = () => {
		if (starting) return;
		starting = true;
		if (loadFailed) return reload();
		track("new-game");
		options.onNewGame?.();
		const pending = preload();
		if (loaded) return start(loaded.game);
		loadingBar.hidden = false;
		pending.then(start, (error: unknown) => {
			console.error(error);
			starting = false;
			loadFailed = true;
			loadingBar.hidden = true;
			loadError.textContent =
				"The game could not load. Check your connection, then choose NEW GAME to reload the page. Or choose SKIP.";
			loadError.hidden = false;
		});
	};

	// The selected item has the cursor. Like a 1990s shooter menu, the mouse and the focus move it too.
	let selected = 0;
	const select = (index: number) => {
		selected = index;
		items.forEach((item, i) => {
			item.classList.toggle("is-selected", i === index);
		});
	};

	const choose = () => {
		if (items[selected] === skip) {
			track("skip");
			navigate(skip.href);
		} else startNewGame();
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
	// A click on the SKIP link follows the link by itself; the Enter key goes through choose().
	const onSkipClick = () => track("skip");
	skip.addEventListener("click", onSkipClick);
	document.addEventListener("keydown", onKeyDown);

	function dispose(): void {
		for (const remove of listeners) remove();
		newGame.removeEventListener("pointerenter", preloadQuietly);
		newGame.removeEventListener("focus", preloadQuietly);
		newGame.removeEventListener("click", startNewGame);
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
