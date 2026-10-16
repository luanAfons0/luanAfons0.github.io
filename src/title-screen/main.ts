import { createTitleScreen } from "./title-screen";

// The Title Screen page entry. It has no game code: the game is a separate chunk that the
// dynamic import below loads on hover or focus of NEW GAME. Manual test only; the logic is in title-screen.ts.

createTitleScreen({
	root: document,
	loadGame: () => import("../main"),
	startGame: (game) => game.startGame(),
	onNewGame() {
		// The NEW GAME user gesture (a click or Enter), before the game code is ready.
		// Start the Audio here (#9): the browser allows sound only after a gesture.
		// Send the `new-game` analytics event here (#13).
	},
});
