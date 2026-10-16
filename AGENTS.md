# Portfolio

A Doom-inspired first-person game, written in TypeScript with Vite, that presents Luan's portfolio. Read `GLOSSARY.md` and use its terms.

## Commands

Use pnpm. `pnpm dev` (dev server), `pnpm build` (type check, then Vite build), `pnpm typecheck`, `pnpm lint` (Biome check), `pnpm format` (Biome fix), `pnpm test` (Vitest, one run), `pnpm size` (gzipped JS budget of 100 KB; run after `pnpm build`), `pnpm bench` (render benchmark, 60 FPS target). Before you commit, `pnpm typecheck && pnpm lint && pnpm test` must pass.

## Commits and pull requests

Commits follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/):

- Subject: `<type>(<scope>): <summary>`. English, imperative, lowercase, no period, 72 characters or less. Types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci`, `chore`, `style`. The scope is optional and names the area: `engine`, `game`, `skip-view`, `title-screen`, `audio`, `analytics`, `assets`, `ci`. Mark a breaking change with `!` after the type or scope.
- Body (optional): why the change was made, wrapped at 72 characters.
- Footer: one `Closes #<n>` line per issue the commit finishes.
- The message describes only the change. It has no `Co-Authored-By` trailer and no AI attribution.
- One logical change per commit.

Pull requests:

- Branch from `main` as `<type>/<short-slug>` (for example `feat/exhibit-panel`). Base is `main`.
- Title: the Conventional Commits subject format, in English.
- Body: in English. One summary line, then one `-` bullet per change, naming the exact file, function, or behavior that changed (for example "Exhibit `id` validation in `content.ts`"). Then one `Closes #<n>` line per issue. Same attribution rule as commits.
- Label `enhancement`, assignee `@me`.
- Merge only when CI is green, with a merge commit (`gh pr merge --merge`), so each commit's `Closes #<n>` stays in the history.

## Code layout

- `src/engine/`: the generic raycaster (Renderer, Collision, Loop, Input). It never imports `src/game/`; a Biome rule enforces this (ADR 0001).
- `src/game/`: the portfolio. `game.ts` is the Game core (test Seam 1): no DOM, no canvas, no timers.
- `src/skip-view/`: the Skip View builder (test Seam 2, `buildSkipView`). It runs at build time only: the `skip-view` plugin in `vite.config.ts` turns `skip/index.html` into the Skip View, from the Content and the Level. The built page has no game code and no script of ours. Only the `goatcounter` plugin in `vite.config.ts` adds the GoatCounter tag to both pages, in the production build only.
- `index.html` is the Title Screen: plain HTML and CSS, plus an inline head script that sends phones to the Skip View before the first paint (ADR 0002). Its entry, `src/title-screen/main.ts`, has no game code: `createTitleScreen` (`src/title-screen/title-screen.ts`, tested with happy-dom on the real `index.html` markup) loads the game with a dynamic `import()` on hover or focus of NEW GAME. Its `onNewGame` hook is the NEW GAME user gesture: start the Audio there. `createTitleScreen` sends the `new-game` and `skip` analytics events itself.
- `src/main.ts`: the browser shell (canvas, `requestAnimationFrame`, keyboard), loaded lazily; `startGame()` runs it. Manual test only. Never import it statically from the Title Screen.
- Tests sit next to the code as `*.test.ts` and go through a seam: `createGame` for Seam 1, `buildSkipView` for Seam 2. Build test Levels with `src/game/test-support/tiled-level.ts`.
- Tiled Levels are in `src/game/levels/`. Biome does not format them, so Tiled can write them.
- Tiled wall tiles name their texture with a `texture` tile property, in a tileset embedded in the Level.
- Tiled Bugs are point objects of type `bug`. Each one must be inside a Room rectangle, where it walks.
- `src/game/content.ts` is the Content: the one typed list of Exhibits. Tiled places each Exhibit as a point object of type `exhibit` inside a wall cell, with an `id` property and a `facing` property (`north`, `east`, `south`, or `west`: the side of the wall the poster is on). Creating the Game core fails when the Level and the Content do not match, so `pnpm test` catches it. Poster PNGs are in `public/posters/`.
- `src/game/theme.ts`: the Themes and the art sets (ADR 0003). It has no imports. An art set names the textures a Level may use, the Bug frames, the sound file of each sound event, and the HUD colors; the browser shell, the Bugs, the HUD, and the Audio read it. `createGame` with `artSet` fails when the Level names a texture or needs a Bug frame the art set does not have. The machine art set still points at `public/freedoom/`.
- `public/freedoom/`: the Freedoom textures, sprites, and sounds the game uses, with the Freedoom license (`COPYING.txt`) and `CREDITS.txt`. `node scripts/extract-freedoom.ts <unzipped freedoom-0.13.0 folder>` makes them once; edit its `ASSETS` list to add more. Never commit a WAD file.

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues on `luanAfons0/portfolio`, through the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Analytics

`src/analytics/analytics.ts` holds the GoatCounter site code (`GOATCOUNTER_SITE`), the script tag, and `track(event)`. `track` uses optional chaining and a `try`, so a blocked script never throws. Events: `new-game` and `skip` (Title Screen), `exhibit/<id>` and `all-bugs-fixed` (Game core, through the `track` option of `createGame`; `all-bugs-fixed` goes once per visit).

## Sound

`src/audio/audio.ts` is the Audio: the sound effects of the art set through Web Audio, no music. Manual test only. The Game core never touches Web Audio: it reports sound events (`shot`, `door-open`) through the `sound` option of `createGame`, and the browser shell passes them to `audio.play`. The Title Screen creates the Audio, and `onNewGame` calls `audio.start()`, which creates the `AudioContext` and loads the WAVs from `public/freedoom/sounds/` then, not before. Add a new event to `SoundEvent` and map it to its WAV in the `sounds` of each art set in `src/game/theme.ts`. M and the Pause Menu sound setting are the same saved setting (`sound` in `src/game/settings.ts`); M mutes all sound through the master gain.
