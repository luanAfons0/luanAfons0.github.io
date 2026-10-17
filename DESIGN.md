---
name: Luan Afonso, portfolio
description: A portfolio you read as a part datasheet, then walk inside as a circuit board.
colors:
  paper: "#f2f3f0"
  paper-2: "#e7e9e4"
  ink: "#16181a"
  ink-2: "#4b5155"
  rule: "#c8ccc5"
  board: "#0f1214"
  board-2: "#161a1d"
  mask-trace: "#1f262a"
  silk: "#e9ebe6"
  silk-2: "#9aa1a5"
  silk-3: "#3a4045"
  pad: "#aeb3b6"
  copper: "#c06a36"
  copper-hot: "#e08a4f"
  scrim: "#070909"
  game-mask: "#1a2024"
  game-trace: "#2c363c"
  game-ceiling: "#0b0d0f"
  game-floor: "#161b1e"
  beetle-sheen: "#5f7a6a"
typography:
  display:
    fontFamily: "Archivo, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(2.75rem, 9vw, 4.75rem)"
    fontWeight: 800
    lineHeight: 0.9
    letterSpacing: "-0.02em"
    fontVariation: "\"wdth\" 72"
  display-silk:
    fontFamily: "Silkscreen, ui-monospace, Cascadia Mono, Menlo, Consolas, monospace"
    fontSize: "round(down, clamp(2rem, 6vw, 3.5rem), 8px)"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0"
  headline:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.15
    fontVariation: "\"wdth\" 85"
  headline-silk:
    fontFamily: "Silkscreen, ui-monospace, monospace"
    fontSize: "24px"
    fontWeight: 400
    lineHeight: 1.2
  title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  lede:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "Silkscreen, ui-monospace, monospace"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1
  label-small:
    fontFamily: "Silkscreen, ui-monospace, monospace"
    fontSize: "max(8px, round(nearest, 0.75em, 8px))"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  none: "0"
  pin: "1px"
  key: "2px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  gutter: "20px"
  lg: "28px"
  xl: "40px"
components:
  part-label-paper:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "8px 12px 6px"
  part-label-board:
    backgroundColor: "{colors.board}"
    textColor: "{colors.silk}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "8px 0 6px"
  part-label-board-open:
    backgroundColor: "{colors.board}"
    textColor: "{colors.copper-hot}"
    typography: "{typography.label}"
    padding: "0.35em 0.6em"
  menu-pin-paper-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    padding: "0.45em 0.7em"
  menu-pad-board:
    backgroundColor: "{colors.pad}"
    rounded: "{rounded.pin}"
    width: "2.4em"
    height: "1.6em"
  menu-pad-board-selected:
    backgroundColor: "{colors.copper}"
    textColor: "{colors.copper-hot}"
    rounded: "{rounded.pin}"
  button-paper:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0.55em 0.9em"
  button-board:
    backgroundColor: "{colors.board}"
    textColor: "{colors.silk}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0.55em 0.9em"
  button-board-hover:
    textColor: "{colors.copper-hot}"
  pause-item:
    backgroundColor: "{colors.board}"
    textColor: "{colors.silk}"
    typography: "{typography.label}"
    padding: "0.7em 0.9em"
  key-cap:
    textColor: "{colors.ink}"
    typography: "{typography.label-small}"
    rounded: "{rounded.key}"
    padding: "0 5px"
  hud-bar:
    backgroundColor: "{colors.game-mask}"
    textColor: "{colors.copper-hot}"
    height: "40px"
---

# Design System: Luan Afonso, portfolio

## Overview

**Creative North Star: "The Datasheet and the Board"**

The portfolio is one electronic part seen two ways. Outside, it is the part's datasheet: cool paper, black ink, a part number (LA-1) in an inked block, rules under headers, a pin configuration figure, a table of contents with dotted leaders. Inside, it is the board the part sits on: matte-black solder mask, copper traces, white silkscreen print, tinned pads. The Title Screen, Exhibit Panel, and Skip View are reading surfaces and carry both looks through one markup; the game, the Pause Menu, and the resume prompt are always the board.

The two looks are the two Themes. **Paper** is the datasheet; **Board** is the circuit board. A saved Theme sets `data-theme` on the root; with none, `prefers-color-scheme` picks (light gives Paper, dark gives Board). Every color on an HTML surface comes from a look token that resolves with `light-dark()`, so one stylesheet serves both. The machine art set (wall textures, Bug frames, posters, sounds, HUD colors) is shared by both Themes and is drawn by a seeded generator, `scripts/machine-art.ts`, not by hand.

The system is dense, flat, and literal. Ornament is taken from real parts and boards, never invented: pin-1 notches, square pads, reference designators, keep-out areas, LED rows, timing diagrams. Copper is scarce and means one thing. Pixel type and pixel art appear only at whole-pixel sizes. State changes are steps, not glows.

**Key Characteristics:**
- Two Themes, one markup: Paper (datasheet) and Board (circuit board), chosen by `data-theme` or the system setting.
- Archivo (variable width) for reading; Silkscreen for labels, pins, Part labels, and pixel UI.
- Copper marks only the live or selected thing.
- Every Exhibit carries one Part label (U1, J1, R1, Q1) that is the same on the wall poster, in the Exhibit Panel, and in the Skip View.
- Square corners (0 to 2px), hairline and 2 to 3px rules, no gradients.
- All game art is procedural, seeded, and names its generator as provenance.

## Colors

A near-neutral cool palette in two materials, plus one metal: copper.

### Primary
- **Copper** (`copper`): traces, pins, pads, underlines, lit LEDs, slider thumbs, "on" switch levers, and the Paper focus ring. On Paper it is never text.
- **Hot Copper** (`copper-hot`): copper as text and as the Board focus ring. Used for the selected Board menu label, the Board link text, the open Exhibit's Part label on Board, the HUD values, and the Board "Fault." label.

### Neutral (Paper: the datasheet)
- **Datasheet Paper** (`paper`): the Paper page and panel surface. Also the text color on any inked block.
- **Paper Shade** (`paper-2`): the Paper fill of the load error note.
- **Black Ink** (`ink`): Paper text, the strong 3px header rule, inked Part label blocks, the chip body, the selected Paper menu item, and Paper buttons.
- **Grey Ink** (`ink-2`): secondary Paper text: header notes, the kind of an Exhibit, footers, pin numbers.
- **Hairline** (`rule`): quiet Paper separators between Exhibits and above the footer.

### Neutral (Board: the circuit board)
- **Solder Mask** (`board`): the Board page, panel, and overlay surface, and the color of the NEW GAME dive.
- **Mask Shade** (`board-2`): the well of DIP and Theme switches.
- **Trace Under Mask** (`mask-trace`): the traces in the board tile; never a text color.
- **Silkscreen** (`silk`): Board text and Board headings.
- **Silkscreen Grey** (`silk-2`): secondary Board text, switch legends, outlined Part labels in the Skip View, the "off" lever.
- **Silkscreen Faint** (`silk-3`): Board outlines and separators: the chip keep-out outline, pad traces, panel borders, dashed separators, unlit LEDs.
- **Tinned Pad** (`pad`): unselected pads and pins in both Themes.
- **Scrim** (`scrim`): the dimmer behind overlays, at 62% (Exhibit Panel, Pause Menu) or 50% (resume prompt).

### Machine art set (game only)
The game's colors live in `scripts/machine-art/palette.ts` and `src/game/theme.ts`, not in CSS. They are the same family as the Board tokens.
- **Game Mask** (`game-mask`): the base of every wall texture and poster, and the HUD bar. It carries sparse light and dark specks for a matte look.
- **Game Trace** (`game-trace`): raised copper under the mask on wall textures.
- **Ceiling** (`game-ceiling`) and **Floor** (`game-floor`): flat fills, shaded by distance like the walls.
- **Beetle Sheen** (`beetle-sheen`): the one off-palette hue, a muted green on the Bug's dark carapace, so the Bug reads as a living thing and not as board.
- The HUD reuses the Board tokens: labels in Silkscreen Grey, values in Hot Copper, hint and crosshair in Silkscreen, outlines in Silkscreen Faint.

### Named Rules
**The Copper Means Live Rule.** Copper marks only what is live or selected: the selected menu item and its pin or pad, active links, "on" switches, the slider thumb, lit LEDs, focus rings, signal traces, the open Exhibit's Part label, and the HUD readouts. Everything else is ink, paper, board, or silkscreen.

**The No Copper Ink Rule.** Copper text fails contrast on Paper. On Paper, copper is a trace, pin, underline, or focus ring; the text it marks stays ink. Use the look tokens `--live-text` (text) and `--live-trace` (lines), never raw copper for text.

**The Look Token Rule.** HTML surfaces use the look tokens (`--surface`, `--surface-2`, `--text`, `--text-2`, `--line`, `--line-2`, `--live-text`, `--live-trace`, `--focus`), which resolve per Theme with `light-dark()`. A surface that is Board in both Themes sets `color-scheme: dark` on itself or uses the palette tokens directly.

## Typography

**Display Font:** Archivo (variable, width 62% to 125%, weight 100 to 900), with system-ui fallback
**Body Font:** Archivo
**Label/Mono Font:** Silkscreen (with ui-monospace fallback)

**Character:** Archivo, condensed and heavy, is the datasheet's engineering grotesque; Silkscreen is the literal print on the board. Paper sets names and titles in condensed Archivo; Board sets the same names and titles in Silkscreen. Both faces are self-hosted from `public/fonts/` under the OFL.

### Hierarchy
- **Display** (Archivo 800, `font-stretch: 72%`, line height 0.88 to 0.9, letter spacing -0.02em): the name "Luan Afonso" on Paper. Title Screen scales it with the sheet (up to 6.08em of the sheet font); the Skip View uses the token size.
- **Display, Board** (Silkscreen 400, snapped down to a multiple of 8px, line height 1): the name on Board.
- **Headline** (Archivo 700 to 800, `font-stretch` 78% to 85%, line height 1 to 1.15): Exhibit titles on Paper. The Exhibit Panel uses 800 at 2.6em of its font.
- **Headline, Board** (Silkscreen 400, 24px in the Skip View, `round(nearest, 2.2em, 8px)` in the Exhibit Panel): Exhibit titles on Board.
- **Title** (Archivo 700, 0.9375rem to 1em, line height 1.2, with a 1px rule under it): datasheet section headings ("Features", "Description", "Links", "Rooms"). On Board these become Silkscreen 16px (Skip View) or are hidden for screen readers only (Exhibit Panel). Room headings in the Skip View are 1.375rem (Paper) or 32px Silkscreen (Board).
- **Body** (Archivo 400, 16px, line height 1.5; 1.55 in the Exhibit Panel details): reading text, capped at 62 to 65ch.
- **Lede** (Archivo 400, 1.1875rem to 1.45em, line height 1.38 to 1.4): the description under the name and the Exhibit summary, capped at 30 to 46ch.
- **Label** (Silkscreen 400, 16px or `round(nearest, 1em, 8px)`, line height 1): menu items, Part labels, part numbers, buttons, pin names, LED and timing labels.
- **Label small** (Silkscreen 400, `max(8px, round(nearest, 0.75em, 8px))`): key caps.

### Named Rules
**The Whole Pixel Rule.** Silkscreen is drawn on an 8px grid. Every Silkscreen size is a whole multiple of 8px, never below 8px. A size that scales is snapped with `max(8px, round(nearest, <size>, 8px))`, or `round(down, ...)` when it must not overflow. A fixed size is written as a multiple of 8px (16px, 24px, 32px).

**The Two Faces Rule.** Archivo reads; Silkscreen labels. Body text, ledes, and long sentences are never Silkscreen. Silkscreen carries names and titles only on Board, where they are print on the board.

## Layout

**The 16:9 sheet.** The Title Screen is a 16:9 sheet that fits the window like the game view (`--u: min(1vw, 1.7778vh)`). Its font is `max(14px, 1.25 × --u)`, and every size inside is in em of that font, so the whole sheet scales as one. The Exhibit Panel uses the same idea: its font is `clamp(14px, min(1.25vw, 2.2222vh), 22px)` and its width is 51em (Paper) or 48em (Board).

**Paper layout.** A datasheet: a header with the part number block left and a document note right, on a 3px ink rule; content in two columns (name, description, and Features left; the pin configuration figure right); a footer above a hairline. Margins are 3.52em of the sheet.

**Board layout.** The name sits inside a chip keep-out outline labeled LA-1; the menu is pads joined by 3px traces to that outline. Columns are 1.15fr and 1fr.

**The Skip View.** One column, max 50rem, 16px side padding. Each Exhibit is a two-column row: a 72px gutter for the Part label and kind, then the text (64px gutter and 16px gap below 35rem). The contents list uses dotted leaders, as a datasheet table of contents.

**The game.** A 640x360 framebuffer, kept at 16:9 and letterboxed in black (`image-rendering: pixelated`). The HUD is a 40px status bar along the bottom, split into outlined sections with 4px margins and 6px padding.

**Spacing.** Fixed spacing is on a 4px base (4, 8, 16, 20, 28, 40px). Overlays keep 16px from the window edge.

### Named Rules
**The Declared Tier Rule.** At narrow sizes, ornament drops in declared steps and content keeps its size. The Title Screen has two tiers: at an aspect ratio of 1:1 or taller it goes to one column, drops the chip outline, and joins the pad traces to a vertical bus; below 600px wide, Paper drops pins 6 to 10 and lists their controls in text instead.

**The Keep-Out Rule.** Board traces never run under text. Text sits on a keep-out (a solid `--surface` area with a silkscreen edge) or on the quiet board tile, whose traces are close to the mask color. The busy tile is for open background only.

## Elevation & Depth

The system is flat. Depth comes from material and from overlays that sit over the paused game, not from layered cards. Only the two pause-time overlays (Exhibit Panel, Pause Menu) cast a shadow, a broad soft drop that lifts the sheet off the dimmed game. The resume prompt has none. Nothing on a page casts a shadow.

### Shadow Vocabulary
- **Sheet over game, Paper** (`box-shadow: 0 18px 50px rgb(0 0 0 / 0.55)`): the Exhibit Panel in Paper.
- **Sheet over game, Board** (`box-shadow: 0 14px 40px rgb(0 0 0 / 0.5)`): the Exhibit Panel in Board and the Pause Menu.

### Named Rules
**The Flat Page Rule.** Pages are flat. A shadow belongs only to an overlay that pauses the game.

## Shapes

Corners are square. The only radii are 1px on pads, pins, and switch thumbs, and 2px on the chip body and key caps. The one curve is the pin-1 notch on the chip body (a half circle). Lines come in three weights: 1px hairlines and separators, 2px outlines (Board panels, Board Part labels, the chip keep-out, focus rings), and 3px strong rules (the Paper header rule, copper and silkscreen traces). Pause Menu separators are 1px dashed. List markers are small square pads, not bullets. Pixel icons are drawn as SVG on an 8x8 grid with `shape-rendering: crispEdges`.

## Components

### Part label
The reference designator of an Exhibit (U project, J contact, R skill, Q job). The same label appears in silkscreen on the wall poster, in the Exhibit Panel, and in the Skip View.
- **Paper:** an inked block, paper text, Silkscreen label size.
- **Board, Skip View:** a 2px Silkscreen Grey outline, Silkscreen text.
- **Board, Exhibit Panel (open Exhibit):** a 2px copper outline with Hot Copper text; the letter encodes the kind, so no kind label shows.
- **Poster:** the label in silkscreen above the component, a copper outline around it; the component shows the kind (IC, connector, resistor, transistor).

### Title Screen menu (pins and pads)
- **Paper:** menu items are pin labels of a 10-pin chip; pins 1 to 3 are the menu (NEW GAME, SKIP, Theme), pins 4 to 10 list the controls, pin 6 is NC. The selected item is an inked block; its pin turns copper and a 3px copper trace joins label to pin.
- **Board:** each item is a pad (2.4em × 1.6em, 1px radius, Tinned Pad) with a 3px silkscreen trace to the chip outline. The selected pad and its trace turn copper; the label turns Hot Copper.
- **Focus:** 2px `--focus` outline, 4px offset. **Press:** 1px down.
- **NEW GAME dive:** a Solder Mask layer grows from the chip (Paper) or the selected pad (Board) to the full window in 420ms (`cubic-bezier(0.77, 0, 0.175, 1)`). Reduced motion skips it.

### Loading and errors
- **Paper loading:** a timing diagram; the CLK wave marches in steps (`steps(2)`, 0.5s).
- **Board loading:** a row of seven LEDs that light copper in steps (`steps(1)`, 0.84s, 120ms stagger).
- **Load error:** a datasheet note ("Note 1.", 1px ink border, Paper Shade) or a fault label ("Fault." in Hot Copper Silkscreen, 2px border, Solder Mask).

### Buttons
- **Shape:** square (0 radius).
- **Paper:** inked block, paper Silkscreen label; hover adds a 2px copper outline at 2px offset.
- **Board:** 1px Silkscreen Grey outline, Silkscreen label; hover and focus turn border and text Hot Copper.
- **Press:** 1px down, everywhere.

### Links
- **Paper:** ink text with a 2px copper underline at 0.25em offset, weight 600. Hover and focus invert to an inked block with paper text.
- **Board:** Hot Copper text with a 2px copper underline, weight 400.

### Pause Menu
A board panel in both Themes: the quiet board tile, a 2px Silkscreen Faint border, 28px × 30px padding, max 460px wide.
- **Items (Resume, Skip View):** a 1px silkscreen outline with a square pad at the right; hover or focus brightens the border to Silkscreen and turns the pad copper.
- **DIP switch (checkbox):** a 1.5em × 2.4em well; the lever is down and grey when off, up and copper when on. The legend reads "On" or "Off" from the state.
- **Theme switch:** one sideways two-position DIP switch, Paper left (grey lever), Board right (copper lever).
- **Slider:** a 2px silkscreen track with a copper thumb (Hot Copper while dragged).
- **Focus:** one 2px Hot Copper ring, 2px offset, on every control.
- **Motion:** rises 8px over 140ms (`cubic-bezier(0.23, 1, 0.32, 1)`); closes at once.

### Exhibit Panel
- **Paper:** a datasheet page over the paused game: the Part label block and the kind on a 3px header rule, then title, summary, "Description" and "Links" sections with 1px rules, and an inked close button.
- **Board:** a board panel on the quiet tile with a 2px silkscreen border: copper Part label, Silkscreen title; section headings stay for screen readers only.
- **Motion:** rises 12px over 140ms with the same ease-out; closes at once.

### Resume prompt
A full-screen button on a 50% scrim, Board in both Themes. A Silkscreen label in a 2px silkscreen box; hover and focus turn the box Hot Copper.

### Skip View
The full datasheet, Room by Room. Paper: LA-1 header, condensed Archivo name, inked Part labels. Board (system dark): the quiet board tile, Silkscreen headings, outlined Part labels. The page has no script, so the system setting always picks the look. The back link is a Silkscreen label with an 8x8 pixel arrow; phones do not see it.

### HUD (game)
A 40px Game Mask bar with a 1px Silkscreen Faint top edge. Sections (ROOM, BUGS FIXED) are 1px outlined boxes, no fill, no bevel; small Silkscreen Grey labels over 2x Hot Copper values in the engine's 5x7 pixel font. The hint ("Press E") is Silkscreen with a one-pixel outline in eight directions so it reads on any wall. The crosshair is four 1px Silkscreen arms.

### Machine art set (game)
- **Wall textures** (64x64): `board-a` and `board-b` (traces, vias, silkscreen footprints like R12, C4, U3), `chip` (a square IC with silver pins), `rack` (slotted panels, two LEDs lit copper), `door` (a board section with an up arrow and connector fingers, labeled P1), `door-track` (a connector socket seen from the side).
- **Bug:** a friendly pixel beetle seen from above, 32x24. Two walk frames in a tripod gait. When fixed, it flashes silkscreen white, breaks up into a grid, fades into a silkscreen box, and ends as the "patched" mark (the box with a check), held for half the fix sequence.
- **Posters** (36x33 grid, written at 2x): one per Exhibit, drawn from the Content.
- **Sounds:** synthesized 16-bit mono WAVs (`shot`, `door-open`).
- **Provenance:** every PNG names the generator in a `Software` chunk; every WAV in its `ISFT` text.

## Do's and Don'ts

### Do:
- **Do** use the look tokens on HTML surfaces and let `light-dark()` pick the Theme; keep the saved-Theme block and the system-setting block of a surface identical.
- **Do** give every Exhibit one Part label and show the same label on the poster, the Exhibit Panel, and the Skip View.
- **Do** snap every Silkscreen size to a multiple of 8px, with `round()` when the size scales.
- **Do** make select, press, and fix step changes: a color swap, a 1px press, frame steps (`steps()`), a "patched" mark.
- **Do** put text on a keep-out or on the quiet board tile, never on the busy trace tile.
- **Do** draw new game art in `scripts/machine-art/` with a fixed seed, and let the file name the generator.
- **Do** take ornament from real datasheets and boards: pin numbers, notches, pads, designators, dotted leaders, LEDs, timing diagrams.

### Don't:
- **Don't** set copper text on Paper; use an ink label with a copper underline or trace.
- **Don't** use copper for anything that is not live or selected.
- **Don't** use soft glows, blurs, or gradients for state.
- **Don't** set body text or long sentences in Silkscreen.
- **Don't** round corners past 2px.
- **Don't** shrink content at narrow sizes; drop ornament in declared steps instead.
- **Don't** add shadows to anything on a page; only overlays over the paused game cast one.
