# Raycasting renderer instead of a Doom-style BSP renderer

Status: superseded by [ADR 0005](0005-freelance-home-replaces-the-game.md). The freelance home page replaced the game. The game stays in git history under the tag `game-final`.

The game looks like Doom, but it renders with Wolfenstein-style raycasting on a grid, not Doom's BSP tree. We chose raycasting because it gets a polished, playable Level done in weeks instead of months, and its code is small enough to explain in an interview. We accept its limits: walls on a grid, all walls the same height, and no stairs. The renderer stays behind the `src/engine/` boundary, so a BSP renderer can replace it later without changes to the game layer.
