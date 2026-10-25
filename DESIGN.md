---
name: Luan Afonso, Shopify developer
description: The Store Audit. A Home page that reads as the audit Luan sends a store owner, measured Frame by Frame, then priced and booked.
colors:
  ground: "#f8f9f8"
  surface: "#ffffff"
  tile: "#eef1ee"
  ink: "#0f1110"
  ink-2: "#454c48"
  ink-3: "#626b66"
  rule: "#e0e4e0"
  rule-2: "#c9cfca"
  pass: "#08704a"
  pass-soft: "#e2f1e9"
  warn: "#b5470f"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(3.2rem, 9vw, 8rem)"
    fontWeight: 680
    lineHeight: 0.88
    letterSpacing: "-0.045em"
  wordmark:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(3.5rem, 15.2vw, 13.5rem)"
    fontWeight: 640
    lineHeight: 0.8
    letterSpacing: "-0.055em"
  headline-contact:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 6.4vw, 5.5rem)"
    fontWeight: 620
    lineHeight: 0.95
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 5vw, 4rem)"
    fontWeight: 620
    lineHeight: 0.98
    letterSpacing: "-0.04em"
  figure:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 620
    lineHeight: 1
    letterSpacing: "-0.035em"
    fontFeature: "tnum"
  title-lg:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 620
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 620
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  lede:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.55
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  body-sm:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 500
    lineHeight: 1.55
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1
  tag:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.04em"
  mono-data:
    fontFamily: "Geist Mono, ui-monospace, SF Mono, Menlo, Consolas, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1
    fontFeature: "tnum"
  mono-price:
    fontFamily: "Geist Mono, ui-monospace, SF Mono, Menlo, Consolas, monospace"
    fontSize: "0.9375rem"
    fontWeight: 500
    lineHeight: 1.2
    fontFeature: "tnum"
rounded:
  pill: "999px"
  tile: "20px"
  laptop: "14px"
  field: "12px"
  seg: "8px"
  focus: "6px"
spacing:
  gutter: "16px"
  wrap: "1280px"
  nav-h: "64px"
  section: "clamp(88px, 12vw, 152px)"
  head-gap: "clamp(36px, 5vw, 56px)"
  column-gap: "clamp(28px, 5vw, 72px)"
  tile-pad: "26px"
  panel-pad: "32px"
  row-pad: "26px 28px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "0 6px 0 22px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "#262a28"
    textColor: "{colors.surface}"
  button-primary-small:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "0 4px 0 16px"
    height: "40px"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "40px"
  button-ghost-pressed:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
  lang-toggle:
    backgroundColor: "{colors.tile}"
    textColor: "{colors.ink-3}"
    rounded: "{rounded.pill}"
    padding: "3px"
    height: "36px"
  lang-toggle-active:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "30px"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    padding: "12px 14px"
  switch:
    backgroundColor: "{colors.rule-2}"
    rounded: "{rounded.pill}"
    width: "44px"
    height: "26px"
  switch-on:
    backgroundColor: "{colors.ink}"
  tile-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.tile}"
    padding: "{spacing.tile-pad}"
  frame:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.tile}"
    width: "288px"
    height: "404px"
  tag:
    textColor: "{colors.ink-2}"
    typography: "{typography.tag}"
    rounded: "{rounded.pill}"
    padding: "6px 10px"
  timestamp-active:
    backgroundColor: "{colors.pass-soft}"
    textColor: "{colors.pass}"
    typography: "{typography.mono-data}"
    rounded: "{rounded.pill}"
    padding: "4px 8px"
  odometer:
    textColor: "{colors.pass}"
    typography: "{typography.figure}"
---

# Design System: Luan Afonso, Shopify developer

## Overview

**Creative North Star: "The Store Audit"**

The Home page reads as the audit report that Luan sends to a store owner. A Demo store loads Frame by Frame, then the page prices the work and books the call. The ground is near-white. The text is near-black ink. Hairline report rules divide the content. One pass-green accent marks only the live element: the active Frame, the key line of a section, the total, and the focus.

One tight grotesk (Geist) carries the display sizes and the body. A mono (Geist Mono) carries only measured data: timestamps, metrics, prices in the Project builder, dates. Content sits in rounded 20px tiles. Actions are pills. State shows as a mark (a check, a tick, a flag, a filled dot), never as a new hue. The page is light only.

The page has one center axis for the hero, the Timeline, and the fan of Frames. The sections below it are left-aligned report blocks. The Virtual scroll moves the page and loops from the footer back to the top. The page refuses the dark freelancer template and the cream editorial portfolio.

**Key Characteristics:**
- Near-white ground, ink text, one pass-green accent on the live element only.
- Geist for all words; Geist Mono for measured data only.
- 20px tiles with a hairline ring; pill actions with an arrow disc.
- Hairline rules as structure: table rows, switch rows, FAQ rows, the Timeline, the Page map.
- State as a mark, not as a color.
- One center axis on the first screen; report blocks below.
- Light color scheme only.

## Colors

A cool near-white and near-black pair with a faint green cast, and one deep green accent.

### Primary
- **Pass Green** (`pass`): the one accent. It marks the active Frame ring, the active timestamp on the Timeline, the speed score ring, the "Recommended" mark, the key phrase in a section intro, the odometer total, the success check, the focus outline, the caret, and the text selection.
- **Pass Wash** (`pass-soft`): the pale green under green text (the active timestamp chip, the selected booking slot, the unfilled part of the score ring) and the 3px focus ring of a form field.

### Neutral
- **Report Ground** (`ground`): the page background, the nav, the table head row, and the contact channels column.
- **Paper White** (`surface`): the face of every tile (Frames, package table, Project estimate, contact panel), the store bands, field backgrounds, and the text on ink.
- **Tile Mist** (`tile`): recessed fills: the EN/PT toggle track, the stage of each store band, photo placeholders, the neutral timestamp chip.
- **Ink** (`ink`): headings, body text, primary pills, switches that are on, filled project strip segments, the Page map fill, done ticks.
- **Ink Two** (`ink-2`): secondary text: subtitles, section intros, list items, table cells, FAQ answers.
- **Ink Three** (`ink-3`): tertiary text: labels, captions, placeholders, idle timestamps, idle icons.
- **Hairline** (`rule`): dividers and the 1px ring around flat tiles.
- **Hairline Strong** (`rule-2`): control borders (ghost pills, fields, chips, tags), the Timeline axis, the process axis, switches that are off, dashed Mock value notes.

### Signal
- **Warn Rust** (`warn`): only the invalid form field border and its error text.

### Named Rules
**The Live Element Rule.** Pass green marks only the thing that is live now: the active Frame, the active timestamp, the total, the key phrase, the focus. Never use it as a fill for a section or a button.

**The Mark Not Hue Rule.** Show state with a mark: a check disc, a flag disc, a filled dot, an inverted pill. Do not add a new color for a state. Warn rust is the only exception, and only for form errors.

## Typography

**Display Font:** Geist (variable, 400 to 700, self-hosted), with `ui-sans-serif, system-ui` fallbacks
**Body Font:** Geist
**Label/Mono Font:** Geist Mono (variable, 400 to 600, self-hosted), with `ui-monospace, SF Mono, Menlo, Consolas` fallbacks

**Character:** One tight grotesk at every size. Large sizes get heavy weights and negative tracking, so headlines read as one dense block. The mono appears only where a number was measured.

### Hierarchy
- **Display** (`display`): the hero headline only. Two lines, centered, balanced, max 15ch.
- **Wordmark** (`wordmark`): the name in the footer. One line, no wrap, cut by the page edge.
- **Headline Contact** (`headline-contact`): the contact heading. Centered, max 14ch.
- **Headline** (`headline`): every section heading. Left-aligned, balanced.
- **Figure** (`figure`): the odometer total of the Project estimate. Tabular figures, pass green.
- **Title Large** (`title-lg`): process step names, demo store names, the success message.
- **Title** (`title`): Chapter headings and Package names.
- **Lede** (`lede`): section intros and the contact intro, in ink-2, max 54ch.
- **Body** (`body`): running text. Answers max 62ch, step text max 30ch.
- **Body Small** (`body-sm`): nav links, list items, field labels, ghost pills.
- **Label** (`label`): the Timeline end labels, the table head row, channel labels, Mock value notes.
- **Tag** (`tag`): the uppercase "Demo" tag on a demo card only.
- **Mono Data** (`mono-data`): Timeline timestamps, Frame URLs and times, the estimate date, the store URL pill on the demo stage.
- **Mono Price** (`mono-price`): prices in the switch rows and the line values of the Project estimate.

### Named Rules
**The Measured Mono Rule.** Use Geist Mono only for a value that is measured or counted: a time, a metric, a price line, a date. Words stay in Geist.

**The Tight Display Rule.** Text at 1.375rem or larger uses weight 620 or more and negative tracking (-0.025em to -0.055em). Body text keeps normal tracking.

## Layout

- **Container:** max 1280px, centered. The side gutter is 16px or the safe-area inset, whichever is larger.
- **Nav:** 64px high, sticky (fixed under the Virtual scroll), on the ground color. The Page map sits on its bottom edge.
- **First screen:** one center axis. The hero headline, the subtext, the actions, the Timeline, and the fan of Frames all center on it. The fan is cut by the bottom edge of the viewport.
- **Filmstrip:** a tall section. Its stage holds still while the scroll steps 4 Frames. Each step is 46vh. The stage is the viewport height less the nav, minimum 600px.
- **Section rhythm:** each section starts with `section` space above. A heading block takes `head-gap` space below it. More space goes above a heading than below it.
- **Two-column blocks:** the Project builder (switches, then a 440px estimate column), the FAQ (heading, then answers at 1 to 1.5), and the contact panel (channels, then form at 1 to 1.4). Each collapses to one column at 900px or 860px.
- **Package table:** a 5-column grid (name, contents, time, price, action at 168px). At 980px it becomes a 2-column card per row and the head row hides.
- **Breakpoints:** 980px (package table), 900px (nav links hide, builder stacks), 1600px and up (the devices on the demo stage grow), 960px (a store band stacks, the stage goes on top), 860px (process, FAQ, contact panel stack), 767px (Filmstrip row mode), 560px (Timeline end labels hide, form is one column, the phone on the demo stage narrows, the Store password field wraps, the store pill fills the row), 420px (the nav pill shows only its arrow disc).
- **Hover:** hover styles apply only under `(hover: hover) and (pointer: fine)`.

## Elevation & Depth

The page is mostly flat. Flat tiles carry a 1px hairline ring, not a shadow. Two tiles float: the Frames and the Project estimate. They use one soft tile shadow. Depth also comes from tone: tile mist recesses, paper white lifts off the ground.

### Shadow Vocabulary
- **Hairline ring** (`box-shadow: 0 0 0 1px var(--rule)`): the package table, the contact panel, the store URL pill.
- **Tile shadow** (`--shadow-tile`): the Frames and the Project estimate.
- **Active Frame** (a 1.5px pass ring plus a deeper drop): the active Frame only.
- **Device drop** (a dark 1px ring plus `0 24px 40px -24px rgb(15 17 16 / 0.45)`): the laptop lid and the phone on the demo stage.
- **Knob**: the switch knob and the pressed EN/PT button.
- **Field focus** (`box-shadow: 0 0 0 3px var(--pass-soft)`): a focused field.

### Named Rules
**The Ring Before Shadow Rule.** A tile that holds a report (table, panel) gets the hairline ring. Only a tile that is a live object (a Frame, the estimate) gets a drop shadow.

## Shapes

Corners are soft and constant. Tiles use 20px. The Demo store bands are the one square surface: they run to the screen edge, so they have no radius. The laptop lid on the demo stage uses 14px on its top corners and 4px on its bottom corners. The phone uses 26px, and its screen 21px. Fields, the Store password field, photos inside Frames, booking days, and the green banner use 12px. Strip segments, photo thumbnails, and Mock value notes use 8px. Every action, toggle, chip, tag, slot, and timestamp chip is a full pill. Small status dots and check discs are circles. The focus outline has a 6px radius. Lines are always 1px.

## Components

### Buttons
- **Shape:** full pill (`rounded.pill`).
- **Primary:** an ink pill, 48px high, weight 560, with a 36px white disc that holds an arrow. "Book a call" uses it.
- **Primary small:** 40px high with a 32px disc. The nav uses it. At 420px or less it shows only the disc.
- **Hover / Focus:** hover darkens the pill and moves the disc 2px right. Press scales to 0.97 in 150ms. Focus is a 2px pass outline at 3px offset.
- **Ghost:** a white pill with a strong hairline border, 40px high. Hover makes the border ink. Pressed ("Add to project" when the Package is in the project) inverts to ink.
- **Text link:** ink-2, weight 500, underlined at 4px offset; ink on hover.

### Nav and Page map
- **Style:** the name mark (weight 640, 1.1875rem, -0.035em), the section links in ink-2, the EN/PT toggle, and the small primary pill.
- **EN/PT toggle:** a tile mist pill track. The active button is a white pill with a knob shadow and ink text.
- **Page map:** a 1px hairline across the bottom of the nav. An ink fill grows from the left with the loop position. A 5px tick marks each section. It replaces the scrollbar.
- **Mobile:** at 900px the section links hide.

### Hero
A centered display headline, a lede subtext in ink-2, then the primary pill and a WhatsApp text link side by side.

### Filmstrip
- **Timeline:** a hairline axis with a label at each end and 4 mono timestamps on ground-colored backing. Each timestamp has a 7px dot. The active dot fills pass green and scales to 1.3. Done dots fill ink.
- **Fan of Frames:** 4 portrait Frames (288 by 404px) fan from one center. Each Frame shifts 300px per step, rotates 3.5deg per step, scales down 7% per step, and fades. The active Frame sits in the center with the pass ring.
- **Frame:** a bar (mono URL and a time chip), then a mini store body: skeleton blocks, photo, chips, an ink pill button, the score ring, check and flag metric rows, booking days and slots.
- **Chapters:** one caption under the fan. Only the active Chapter shows. It cross-fades with a small rise and blur.
- **Row mode:** at 767px or less, or with reduced motion, the stage stops holding. The Frames become a horizontal swipe row (280px wide, snap to center, no scrollbar).

### Package table
A white tile with a hairline ring. A ground-colored head row with labels. Each row has the Package name (with a green "Recommended" check when it applies), a dotted list, the time, a from-price (weight 600, 1.5rem, tabular), and a ghost "Add to project" pill. A dashed Mock value note sits under the table.

### Project builder
- **Switch rows:** hairline-divided rows. Each has a name, a short description in ink-3, a mono price, and a switch.
- **Switch:** 44 by 26px pill. Off is strong hairline gray; on is ink. The 20px white knob slides 18px and stretches to 24px while pressed.
- **Project estimate:** a sticky floating tile. A heading with a mono date, the project strip, numbered lines, a hairline, the total, a note, and the primary pill.
- **Project strip:** 44px high. One segment per service, sized by weight, 3px apart, 8px corners. Paid segments are ink; free segments are white with a hairline. A new segment locks in (scales from 0.2 with a small overshoot in 280ms). The empty state is a dashed outline.
- **Odometer:** the total in pass green. Each digit is a column that rolls to the new value in 480ms.

### Process steps
Four columns on one hairline axis. Each step has a 15px ring mark (the first one filled ink), a mono step number, a title, and text. At 860px the axis turns vertical on the left.

### Demo stores
- **Store band:** the three stores stand one under the other. Each is a full-width band on paper white, with a hairline on its top and bottom edge and no radius. Two bands next to each other share one hairline. A band has two parts: the text on white and the stage. The text column keeps to the 1280px container line on its side (a container query on `.stores` sets the edge). The stage runs to the screen edge on the other side. The side changes on each row: text first, media first, text first.
- **Text:** the store name (weight 640, -0.035em), the uppercase "Demo" tag, the store type in ink-3, and one line in ink-2, then the proof row and the access block. At 960px the band stacks and the stage goes on top.
- **Proof row:** between two hairlines. A 64px Lighthouse ring (4px, pass green on pass wash, filled to the score) holds the mobile speed score in pass green. Next to it are the label and the source line in ink-3.
- **Access:** the Store password field (52px high, strong hairline border, 12px corners, ground fill) holds the label, the password, and a ghost "Copy" pill. After a copy, the copy icon swaps to a pass check that pops in 180ms. Under it is the primary pill "Open the store" with an up-right arrow in its disc, then a hint in ink-3. On hover the disc moves 1px up and 1px right.
- **Stage:** a tile mist field with no frame. A white URL pill with the hairline ring sits at the top center. A laptop and a phone stand on one base line. The phone stands on the outer side, so on a media-first row it goes to the left. Each device has a dark body (`#1b1e1c`) and the device drop, and holds a real screen recording of the store (laptop 16 by 10, phone 390 by 844). Above 1600px the devices grow (laptop up to 820px). A recording plays only while it is on screen, and never with reduced motion. With JavaScript off, the posters show.

### FAQ
Hairline-divided disclosure rows. The summary is 1.125rem, weight 560. A plus icon in ink-3 rotates 45deg to ink when open.

### Contact panel and form
- **Panel:** a flat tile split in two: ground-colored channels (label, value, a small ghost "Copy" pill) and the form.
- **Fields:** strong hairline border, 12px corners, white fill, 12 by 14px padding. Hover makes the border ink-3.
- **Focus:** the border turns ink and a 3px pass wash ring shows. No outline.
- **Error:** the border and the error text turn warn rust.
- **Sent:** the form gives way to a success block with a pass check. It fades and rises 6px in 220ms.

### Footer
A hairline row with links and credits in ink-3, then the name as the giant wordmark. After the footer, the Virtual scroll shows the top of the page again.

### Mock value note
A dashed strong hairline box, 8px corners, label type in ink-3. It marks every group of Mock values. Keep it until the real values exist.

## Do's and Don'ts

### Do:
- **Do** keep pass green on the live element only: the active Frame, the active timestamp, the key phrase, the total, the focus.
- **Do** show state with a mark (check disc, flag disc, filled dot, inverted pill) on ink and white.
- **Do** put measured numbers in Geist Mono with tabular figures, and all words in Geist.
- **Do** use 20px tiles; give report tiles the hairline ring and live tiles the tile shadow.
- **Do** make every action a pill; the primary action is ink with the white arrow disc.
- **Do** ease scroll-linked motion with `cubic-bezier(0.32, 0.72, 0, 1)` and UI responses with `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Do** honor reduced motion: the Virtual scroll jumps to its target, the Filmstrip shows the swipe row, and Chapters only cross-fade in 200ms.
- **Do** apply hover styles only for a fine pointer that can hover.
- **Do** label every Demo store "Demo" and mark every Mock value with the dashed note.

### Don't:
- **Don't** add a dark theme or a dark section. The color scheme is light only.
- **Don't** add a second accent hue, or use green as a large fill.
- **Don't** use the mono for headings, labels, or running text.
- **Don't** use square buttons or square tiles.
- **Don't** add drop shadows to flat report tiles; use the hairline ring.
- **Don't** add a small uppercase label above a section heading. A section opens with its heading.
- **Don't** show a native scrollbar under the Virtual scroll; the Page map takes its place.
