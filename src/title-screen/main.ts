import { createAudio } from "../audio/audio";
import { createTitleScreen } from "./title-screen";

// The Title Screen page entry. It has no game code: the game is a separate chunk that the
// dynamic import below loads on hover or focus of NEW GAME. Manual test only; the logic is in title-screen.ts.

// The Audio creates nothing and loads nothing until NEW GAME starts it.
const audio = createAudio(`${import.meta.env.BASE_URL}freedoom/sounds`);

createTitleScreen({
	root: document,
	loadGame: () => import("../main"),
	startGame: (game) => game.startGame(audio),
	onNewGame() {
		// The NEW GAME user gesture (a click or Enter), before the game code is ready.
		// The browser allows sound only after a gesture, so the Audio starts here.
		// The `new-game` analytics event is sent by createTitleScreen.
		audio.start();
	},
});
