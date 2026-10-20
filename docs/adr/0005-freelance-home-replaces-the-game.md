# The freelance home page replaces the game

Luan starts to work as a freelance Shopify developer. The site was a first-person game. Store owners read a game as a toy, not as a service, so they could not see quickly what Luan does, what it costs, or how to book a call. Now the site is one freelance home page, "The Store Audit", in English and Portuguese. The approved mock (`.impeccable/mocks/ui-studio/freelance-home.html`) is the rule for its layout, copy, motion, and behavior.

The game leaves the site: the raycaster engine, the Game core, the Exhibit Panel, the Pause Menu, the HUD, the Bugs, the Levels, the Skip View, the Title Screen, the Audio, the Themes and their art sets, the art generators, the game fonts, and the render benchmark. We do not keep the game on a side route. The game stays in git history: the tag `game-final` marks the last game commit on `main`.

This supersedes ADRs 0001 to 0004:

- ADR 0001 (raycasting renderer): there is no renderer.
- ADR 0002 (no touch controls, phones get the Skip View): the home page works on phones, so there is no phone redirect and no Skip View.
- ADR 0003 (Themes and generated art): there are no Themes and no generated art. The page is light only, and the demo store photos have a free license with credits.
- ADR 0004 (Dungeon is the default Theme): there are no Themes.

We keep pnpm, Vite, TypeScript with no framework, Biome, Vitest, the gzipped JS budget of 100 KB, and GoatCounter analytics with no cookies (`track(event)`). The page markup is static HTML in `index.html`, so all content shows with JavaScript off. JavaScript adds the Virtual scroll and the other behavior of the mock.

We accept that the site no longer shows the engine craft of the game. The page shows the work a store owner pays for instead.
