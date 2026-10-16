# Raycasting renderer instead of a Doom-style BSP renderer

The game looks like Doom, but it renders with Wolfenstein-style raycasting on a grid, not Doom's BSP tree. We chose raycasting because it gets a polished, playable Level done in weeks instead of months, and its code is small enough to explain in an interview. We accept its limits: walls on a grid, all walls the same height, and no stairs. The renderer stays behind the `src/engine/` boundary, so a BSP renderer can replace it later without changes to the game layer.
