import { type Audio, createAudio } from "../audio/audio";
import { type ArtSet, artSetOf, shownTheme } from "../game/theme";
import { createTitleScreen } from "./title-screen";

// The Title Screen page entry. It has no game code: the game is a separate chunk that the
// dynamic import below loads on hover or focus of NEW GAME. Manual test only; the logic is in title-screen.ts.

/**
 * The art set of the shown Theme: `data-theme` on the root (the saved Theme, or the default
 * Theme).
 */
function shownArtSet(): ArtSet {
	return artSetOf(shownTheme(document.documentElement));
}

// The Audio creates nothing and loads nothing until NEW GAME starts it.
let audio: Audio | undefined;

createTitleScreen({
	root: document,
	// The Title Screen loads the game again after a Theme change, so the art is always of the shown Theme.
	async loadGame() {
		const game = await import("../main");
		await game.loadArt(shownArtSet());
		return game;
	},
	startGame: (game) => game.startGame(shownArtSet(), audio),
	onNewGame() {
		// The NEW GAME user gesture (a click or Enter), before the game code is ready.
		// The browser allows sound only after a gesture, so the Audio starts here, with the sounds
		// of the shown Theme. The `new-game` analytics event is sent by createTitleScreen.
		audio = createAudio(import.meta.env.BASE_URL, shownArtSet());
		audio.start();
	},
});
