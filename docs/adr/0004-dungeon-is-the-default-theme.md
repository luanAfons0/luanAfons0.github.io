# Dungeon is the default Theme

A visitor with no saved Theme now sees Dungeon on every surface: the Title Screen, the game (the dungeon art set), the Pause Menu, and the Skip View, also with JavaScript off. A saved Theme still wins. Paper and Board stay as choices in the Theme select and the Theme switch.

This replaces the system look of ADR 0003 and of its amendment on the Skip View: with no saved Theme, the system light or dark setting (`prefers-color-scheme`) no longer chooses Paper or Board, and Dungeon is no longer "saved only". No Theme follows the system setting.

The default is one constant, `DEFAULT_THEME` in `src/game/theme.ts`. `shownTheme` and `artSetOf` fall back to it. Both pages carry it as `data-theme` on their root in the HTML, filled in at build time from the constant (`index.html` through `titleScreenPage`, the Skip View through `buildSkipView`), so a page always has a Theme on its root, with or without script. The Theme head script only replaces it with a saved Theme. So the CSS has no rules for a root with no `data-theme`, and it keeps no copy of the Board rules for a dark system.

We accept that a visitor on a light or dark system no longer gets a matching machine look on the first visit: Dungeon is the look we want every visitor to meet first. Paper and Board still set `color-scheme` (light and dark), so the look tokens keep `light-dark()`.
