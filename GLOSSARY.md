# Portfolio

A Doom-inspired first-person game that presents Luan's portfolio. Visitors walk through a Level to discover Exhibits, or use the Skip View to read the same content without playing.

## Language

**Level**:
The whole map the player walks through.
_Avoid_: Map, world, stage

**Room**:
One named area of the Level.
_Avoid_: Area, zone, section

**Exhibit**:
One portfolio item (a project, a job, a skill, or contact info) that the player can see and use in a Room. A Room can hold many Exhibits.
_Avoid_: Project (when meaning the in-game item), item, card

**Exhibit Panel**:
The overlay that shows the full details of one Exhibit while the game is paused.
_Avoid_: Modal, popup, dialog

**Content**:
The one typed list of every Exhibit (`src/game/content.ts`). The game, the Exhibit Panel, and the Skip View all show the Content, and the art generators draw one poster for each Exhibit in it.
_Avoid_: Data, portfolio data, projects list

**Poster**:
The image of one Exhibit on its wall in the Level, with its Part label. Each art set has one poster per Exhibit of the Content, named by the Exhibit id. In the Dungeon Theme a poster looks like a banner, but it is still a poster.
_Avoid_: Picture, sign, Banner (as the name of the thing)

**Part label**:
The short label of an Exhibit, such as U1, derived from its kind and its order among Exhibits of that kind in the Content (project U, contact J, skill R, job Q). The game, the Exhibit Panel, and the Skip View show the same Part label.
_Avoid_: ID, code

**Bug**:
A harmless enemy that the player can shoot. Each Bug the player shoots counts as fixed. In the Dungeon Theme a Bug looks like a green Slime, but it is still a Bug.
_Avoid_: Enemy, monster, target, Slime (as the name of the thing)

## Screens

**Title Screen**:
The first screen a desktop visitor sees, where they choose to play or open the Skip View.
_Avoid_: Menu, home, start page

**Pause Menu**:
The in-game menu the player opens during play to resume, change options, or go to the Skip View.
_Avoid_: Options menu, settings screen, Esc menu

**Skip View**:
The plain, non-game page that shows every Exhibit. Phones always get it.
_Avoid_: Fallback page, list view, classic mode

## Looks

**Theme**:
The named look of the whole portfolio: Paper, Board, or Dungeon. A Theme is an art set (the textures, Bug frames, sounds, and HUD colors the game uses) plus a look for the HTML screens; Paper and Board share the machine art set (a circuit board), and Dungeon has its own (a torch-lit stone keep, with the HTML screens as a gamebook).
_Avoid_: Skin, mode

**Art set**:
Everything the game draws and plays for a Theme: the wall texture of each texture role, the ceiling Flat and the floor Flat, the Bug frames, the posters, the sound of each sound event, and the HUD colors. Every art set has both Flats. The look of the HTML screens is not part of it. Paper and Board use the machine art set; Dungeon uses the dungeon art set.
_Avoid_: Asset pack, texture pack, tileset

**Texture role**:
The part a wall plays in the Level: `wall-a`, `wall-b`, `feature`, `storage`, `door`, or `door-track`. Each art set maps every texture role to one of its own textures, and a Level names only texture roles, so one Level works with every art set.
_Avoid_: Texture name, texture file, wall type

**Flat**:
The texture of the ceiling or of the floor in an art set, as in Doom. One Flat covers exactly one tile and repeats on every tile, and it gets darker with distance like the walls. A Flat is not a texture role: a Level never names a Flat, so each art set has one ceiling Flat and one floor Flat for the whole Level.
_Avoid_: Floor texture, ceiling texture, plane
