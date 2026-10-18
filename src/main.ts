import { track } from "./analytics/analytics";
import type { Audio } from "./audio/audio";
import { createFramebuffer } from "./engine/framebuffer";
import { createKeyboardInput, type InputSnapshot, isTextEntry } from "./engine/input";
import { createFixedStepLoop } from "./engine/loop";
import { createMouseLook } from "./engine/pointer-lock";
import type { SpriteImage } from "./engine/renderer";
import { loadTexture, type Texture } from "./engine/texture";
import { EXHIBITS } from "./game/content";
import { createExhibitPanel } from "./game/exhibit-panel";
import {
	bugFrameNames,
	createGame,
	levelTextureNames,
	SCREEN_HEIGHT,
	SCREEN_WIDTH,
	TICKS_PER_SECOND,
} from "./game/game";
import sampleLevel from "./game/levels/sample.json";
import { createPauseMenu } from "./game/pause-menu";
import { createResumePrompt } from "./game/resume-prompt";
import { loadSettings, saveSettings } from "./game/settings";
import { type ArtSet, artSetOf, isTextureRole, posterPath, type TextureRole } from "./game/theme";

// The browser shell: it owns the canvas, the clock, the keyboard, the mouse, and the overlays.
// Everything it does is manual-test only; the Game core has the tests.
// The Title Screen loads this module with a dynamic import (on hover or focus of NEW GAME), then
// loadArt() loads the art of the shown Theme, so both are ready when the game can start.
// startGame() runs the game. A Theme switch in the Pause Menu changes the art set during play.

/** The decoded art of one art set: wall textures by texture role and Flats by file name, Bug sprites, and Exhibit posters. */
interface GameArt {
	textures: Record<string, Texture>;
	sprites: Record<string, SpriteImage>;
	posters: Record<string, Texture>;
}

/** The art of each art set once it is loaded, and the load of each art set, so each loads once. */
const loadedArt = new Map<ArtSet, GameArt>();
const artLoads = new Map<ArtSet, Promise<void>>();

/**
 * Loads and decodes every wall texture, Flat, Bug sprite, and Exhibit poster of an art set, once, before
 * the first frame. A failed load is forgotten, so the next call tries again.
 */
export function loadArt(artSet: ArtSet): Promise<void> {
	let load = artLoads.get(artSet);
	if (!load) {
		load = fetchArt(artSet).then(
			(art) => {
				loadedArt.set(artSet, art);
			},
			(error: unknown) => {
				artLoads.delete(artSet);
				throw error;
			},
		);
		artLoads.set(artSet, load);
	}
	return load;
}

/**
 * The art of an art set. All files are in the art set folders under public/. The Level names
 * texture roles, and the art set maps each role to its file. The Flats are in the textures folder,
 * named by their files. The poster of an Exhibit is named by its id.
 */
async function fetchArt(artSet: ArtSet): Promise<GameArt> {
	const base = import.meta.env.BASE_URL;
	const roles = levelTextureNames(sampleLevel)
		// createGame and game.changeArtSet name a texture that is not a role or has no file; load only the others.
		.filter((name): name is TextureRole => isTextureRole(name) && Boolean(artSet.textures[name]));
	const textureFiles = [
		...roles.map((role) => [role, artSet.textures[role]] as const),
		...Object.values(artSet.flats).map((name) => [name, name] as const),
	];
	const [textureEntries, spriteEntries, posterEntries] = await Promise.all([
		Promise.all(
			textureFiles.map(
				async ([key, file]) => [key, await loadTexture(`${base}${artSet.folders.textures}/${file}.png`)] as const,
			),
		),
		loadSprites(`${base}${artSet.folders.sprites}`, bugFrameNames(artSet)),
		Promise.all(EXHIBITS.map(async ({ id }) => [id, await loadTexture(`${base}${posterPath(artSet, id)}`)] as const)),
	]);
	return {
		textures: Object.fromEntries(textureEntries),
		sprites: Object.fromEntries(spriteEntries),
		posters: Object.fromEntries(posterEntries),
	};
}

/** The key that mutes and unmutes all sound. Keys are `KeyboardEvent.code` values. */
const MUTE_KEY = "KeyM";
/** The overlays above the canvas. Keys pressed in them are not for the game. */
const OVERLAYS = ".exhibit-panel, .pause-menu, .resume-prompt";

/**
 * Starts the game in the page's #screen canvas, with the art set of the shown Theme, whose art
 * `loadArt` loaded. The Title Screen calls it after NEW GAME, with the Audio it started in the NEW
 * GAME user gesture. Without an Audio, the game is silent.
 */
export function startGame(startArtSet: ArtSet, audio?: Audio): void {
	const art = loadedArt.get(startArtSet);
	if (!art) throw new Error(`The art of the "${startArtSet.name}" art set is not loaded: call loadArt() first.`);
	const canvas = document.querySelector<HTMLCanvasElement>("#screen");
	const context = canvas?.getContext("2d");
	if (!canvas || !context) throw new Error("The page has no #screen canvas with a 2D context.");
	canvas.width = SCREEN_WIDTH;
	canvas.height = SCREEN_HEIGHT;
	canvas.hidden = false;
	canvas.focus();

	const settings = loadSettings();
	audio?.setMuted(!settings.sound);
	const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
	const game = createGame({
		level: sampleLevel,
		artSet: startArtSet,
		content: EXHIBITS,
		track,
		sound: (event) => audio?.play(event),
		textures: art.textures,
		sprites: art.sprites,
		posters: art.posters,
		settings: {
			mouseSensitivity: settings.mouseSensitivity,
			invertMouse: settings.invertMouse,
			reducedMotion: reducedMotion.matches,
		},
	});
	reducedMotion.addEventListener("change", (event) => game.updateSettings({ reducedMotion: event.matches }));

	/** The art set the game draws with, and the art set of the last Theme the player chose. */
	let shownArtSet = startArtSet;
	let wantedArtSet = startArtSet;

	/**
	 * The Pause Menu Theme switch. Paper and Board share one art set, so a switch between them
	 * changes nothing here. Another art set is loaded first (once, then from the cache), and the
	 * current art stays until then. A failed load or check rejects, and the Pause Menu sets the Theme back.
	 */
	async function changeArtSet(next: ArtSet): Promise<void> {
		wantedArtSet = next;
		if (next === shownArtSet) return;
		await loadArt(next);
		// The player chose another Theme while this art loaded.
		if (wantedArtSet !== next) return;
		const nextArt = loadedArt.get(next);
		if (!nextArt) throw new Error(`The art of the "${next.name}" art set is not loaded.`);
		game.changeArtSet({ artSet: next, ...nextArt });
		shownArtSet = next;
		audio?.changeArtSet(next);
	}

	// Keys pressed in an overlay are for the overlay: the arrow keys scroll the Exhibit Panel, and
	// Enter or Space press a button.
	const keyboard = createKeyboardInput(window, {
		belongsToPage: (target) => target instanceof Element && target.closest(OVERLAYS) !== null,
	});
	const mouse = createMouseLook(canvas, (locked) => {
		// The browser releases the mouse when the player presses Esc (or leaves the window): pause.
		// An open Exhibit Panel releases the mouse on purpose, so the visitor can click its links.
		if (!locked && !exhibitPanel.isOpen()) openPauseMenu();
	});
	const exhibitPanel = createExhibitPanel({ parent: document.body, onClose: closeExhibitPanel });
	const resumePrompt = createResumePrompt({ parent: document.body, onResume: resumeFromPrompt });
	const exhibitsById = new Map(EXHIBITS.map((exhibit) => [exhibit.id, exhibit]));
	const pauseMenu = createPauseMenu({
		parent: document.body,
		settings,
		onResume: resume,
		track,
		onThemeChange: (theme) => changeArtSet(artSetOf(theme)),
		// The Pause Menu owns the settings from here on, so the shell keeps no copy that can go stale.
		onSettingsChange(changed) {
			game.updateSettings({ mouseSensitivity: changed.mouseSensitivity, invertMouse: changed.invertMouse });
			audio?.setMuted(!changed.sound);
			saveSettings(changed);
		},
	});

	function openPauseMenu(): void {
		if (pauseMenu.isOpen()) return;
		resumePrompt.close();
		game.pause();
		const { bugsFixed, bugsTotal } = game.state();
		pauseMenu.open({ fixed: bugsFixed, total: bugsTotal });
	}

	function resume(): void {
		pauseMenu.close();
		game.resume();
		canvas?.focus();
		// Resume is a click or key press, so the browser lets the page capture the mouse again,
		// and resume the sound if it suspended the audio context.
		mouse.lock();
		audio?.start();
	}

	/** Shows the Exhibit Panel when the Game core opened an Exhibit (the player pressed E on it). */
	function showOpenExhibit(): void {
		const id = game.openExhibitId();
		if (id === null || exhibitPanel.isOpen()) return;
		const exhibit = exhibitsById.get(id);
		if (!exhibit) throw new Error(`The Game core opened Exhibit "${id}", which is not in the Content.`);
		exhibitPanel.open(exhibit);
		// Release the mouse so the visitor can click the links. The lock callback sees the open panel.
		mouse.unlock();
	}

	/** Close: a click (a user gesture), so the page can capture the mouse again and resume at once. */
	function closeExhibitPanel(): void {
		exhibitPanel.close();
		game.closeExhibit();
		canvas?.focus();
		mouse.lock();
	}

	/**
	 * Esc is not a user gesture, so the browser refuses to capture the mouse after it. The Game core
	 * stays paused behind "Click to resume" until a click (a gesture) resumes it.
	 */
	function closeExhibitPanelWithEsc(): void {
		exhibitPanel.close();
		game.closeExhibit();
		game.pause();
		resumePrompt.open();
	}

	function resumeFromPrompt(): void {
		resumePrompt.close();
		game.resume();
		canvas?.focus();
		mouse.lock();
		audio?.start();
	}

	// A click into the game captures the mouse. It is a user gesture too, so it resumes the sound
	// if the browser suspended the audio context.
	canvas.addEventListener("click", () => {
		audio?.start();
		if (!pauseMenu.isOpen() && !exhibitPanel.isOpen()) mouse.lock();
	});
	// While the mouse is captured, the browser keeps Esc and releases the mouse (see above).
	// Without capture (keyboard-only play, an open Exhibit Panel, or "Click to resume"), Esc reaches the page.
	window.addEventListener("keydown", (event) => {
		// M works everywhere but in a text field; a checkbox or slider in the Pause Menu takes no text.
		if (event.code === MUTE_KEY && !event.repeat && !isTextEntry(event.target)) pauseMenu.toggleSound();
		if (event.code !== "Escape") return;
		if (exhibitPanel.isOpen()) {
			event.preventDefault();
			closeExhibitPanelWithEsc();
		} else if (!mouse.isLocked()) {
			openPauseMenu();
		}
	});

	const loop = createFixedStepLoop({ ticksPerSecond: TICKS_PER_SECOND });
	const framebuffer = createFramebuffer(SCREEN_WIDTH, SCREEN_HEIGHT);
	// Shares memory with the framebuffer, so there is no copy per frame.
	const image = new ImageData(new Uint8ClampedArray(framebuffer.pixels.buffer), SCREEN_WIDTH, SCREEN_HEIGHT);

	const input: InputSnapshot = { forward: 0, strafe: 0, turn: 0, look: 0, lookUp: 0, shoot: false, use: false };
	const tick = () => {
		keyboard.snapshot(input);
		// All mouse movement since the last tick goes into this tick, so none is lost or counted twice.
		input.look = mouse.takeLook();
		input.lookUp = mouse.takeLookUp();
		input.shoot = mouse.takeShot();
		game.step(input);
	};
	let last: number | undefined;

	function frame(now: number): void {
		loop.advance(last === undefined ? 0 : now - last, tick);
		last = now;
		showOpenExhibit();
		game.render(framebuffer);
		context?.putImageData(image, 0, 0);
		requestAnimationFrame(frame);
	}

	requestAnimationFrame(frame);
}

/** Sprite PNGs have no place for the anchor, so the anchors come from offsets.json in the sprites folder. */
async function loadSprites(spritesUrl: string, names: readonly string[]): Promise<(readonly [string, SpriteImage])[]> {
	const response = await fetch(`${spritesUrl}/offsets.json`);
	if (!response.ok) throw new Error(`Cannot load sprite offsets: HTTP ${response.status}.`);
	const offsets = (await response.json()) as Record<string, { left: number; top: number } | undefined>;
	return Promise.all(
		names.map(async (name) => {
			const offset = offsets[name];
			if (!offset) throw new Error(`offsets.json has no anchor for sprite "${name}".`);
			const texture = await loadTexture(`${spritesUrl}/${name}.png`);
			return [name, { texture, left: offset.left, top: offset.top }] as const;
		}),
	);
}
