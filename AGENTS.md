# Portfolio

A Doom-inspired first-person game, written in TypeScript with Vite, that presents Luan's portfolio. Read `GLOSSARY.md` and use its terms.

## Commands

Use pnpm. `pnpm dev` (dev server), `pnpm build` (type check, then Vite build), `pnpm typecheck`, `pnpm lint` (Biome check), `pnpm format` (Biome fix), `pnpm test` (Vitest, one run), `pnpm size` (gzipped JS budget of 100 KB; run after `pnpm build`), `pnpm bench` (render benchmark, 60 FPS target). Before you commit, `pnpm typecheck && pnpm lint && pnpm test` must pass.

## Code layout

- `src/engine/`: the generic raycaster (Renderer, Collision, Loop, Input). It never imports `src/game/`; a Biome rule enforces this (ADR 0001).
- `src/game/`: the portfolio. `game.ts` is the Game core (test Seam 1): no DOM, no canvas, no timers.
- `src/main.ts`: the browser shell (canvas, `requestAnimationFrame`, keyboard). Manual test only.
- Tests sit next to the code as `*.test.ts` and go through a seam: `createGame` for Seam 1. Build test Levels with `src/game/test-support/tiled-level.ts`.
- Tiled Levels are in `src/game/levels/`. Biome does not format them, so Tiled can write them.
- Tiled wall tiles name their texture with a `texture` tile property, in a tileset embedded in the Level.
- `src/game/content.ts` is the Content: the one typed list of Exhibits. Tiled places each Exhibit as a point object of type `exhibit` inside a wall cell, with an `id` property and a `facing` property (`north`, `east`, `south`, or `west`: the side of the wall the poster is on). Creating the Game core fails when the Level and the Content do not match, so `pnpm test` catches it. Poster PNGs are in `public/posters/`.
- `public/freedoom/`: the Freedoom textures, sprites, and sounds the game uses, with the Freedoom license (`COPYING.txt`) and `CREDITS.txt`. `node scripts/extract-freedoom.ts <unzipped freedoom-0.13.0 folder>` makes them once; edit its `ASSETS` list to add more. Never commit a WAD file.

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues on `luanAfons0/portfolio`, through the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
