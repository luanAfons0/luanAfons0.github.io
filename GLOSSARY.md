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

**Bug**:
A harmless enemy that the player can shoot. Each Bug the player shoots counts as fixed.
_Avoid_: Enemy, monster, target

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
