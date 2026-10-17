# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Recruiters and developers on a desktop browser who judge Luan Afonso's skills as a software engineer. They have a few minutes and want to know who Luan is, what he built, and how to contact him. Phone visitors always get the Skip View.

## Product Purpose

Luan's portfolio, presented as a first-person game: the visitor walks a Level, reads Exhibits (projects, jobs, skills, contact), and fixes Bugs. Success: the visitor remembers Luan and knows how to reach him. The Skip View gives the same content as a plain page for anyone who does not want to play.

## Positioning

The game engine is the proof. The raycaster, the Level pipeline, and the content checks are written by hand in TypeScript, so playing the portfolio demonstrates the skill it describes.

## Operating Context

- Desktop: keyboard and mouse (WASD, mouse look with pointer lock, E to use, click to shoot, Esc to pause, M to mute).
- Title Screen first, then the game; the Pause Menu and the Exhibit Panel pause play.
- Phones are redirected to the Skip View before first paint (ADR 0002).

## Capabilities and Constraints

- TypeScript + Vite, no framework. 640x360 framebuffer raycaster (ADR 0001). Levels drawn in Tiled.
- Gzipped JS budget of 100 KB. 60 FPS render target.
- The Skip View is built at build time. Its only script is the Theme head script, which sets the saved Theme (ADR 0003); the page works fully without it.
- Glossary terms are binding: Level, Room, Exhibit, Exhibit Panel, Bug, Title Screen, Pause Menu, Skip View (see `GLOSSARY.md`).
- Keyboard navigation and `prefers-reduced-motion` must keep working.
- Copy is in English.
- Art and sounds must be original or carry a free license with credits.

## Brand Commitments

- Name: Luan Afonso.
- Voice: plain, direct, a little playful (Bugs are "fixed", not killed).

## Evidence on Hand

- Exhibits in `src/game/content.ts` are samples (one project, a sample job, a TypeScript skill, contact). Real work history comes later; never invent employers, dates, or metrics.
- Source code: https://github.com/luanAfons0/portfolio. GitHub profile: https://github.com/luanAfons0.

## Product Principles

1. Playing is optional; the content is never locked behind the game.
2. The craft of the engine is part of the message.
3. Harmless and friendly: no gore, no hostility.
4. Fast to load, fast to read.
