# Portfolio

The freelance site of Luan Afonso, a Shopify developer. It is one Home page in English and Portuguese. Store owners read what Luan does, see how Luan works, build a Project list, and book a call. The page shows no service prices: the price comes after the call.

## Language

**Home page**:
The one page of the site, "The Store Audit". The approved mock (`.impeccable/mocks/ui-studio/freelance-home-no-prices.html`) is the rule for its layout, copy, motion, and behavior.
_Avoid_: Landing page, Title Screen, portfolio (as the name of the page)

**Mock value**:
A placeholder value that Luan replaces with the real value later. The page has none now: the three Demo stores are real. A new Mock value gets a dashed note on the page (`.mock-note`) and a `MOCK VALUES` comment in the code, and keeps both until Luan gives the real value.
_Avoid_: Fake data, dummy value. "The mock" alone is the approved design file, not a Mock value.

**Demo store**:
A real Shopify development store that Luan built as a work sample: Café Serra, Ateliê Lume, and Orvalho. It is not client work, and the page always labels it "Demo" or "Demo data". The Demo stores section opens each store and gives its Store password; the Frames of the Filmstrip still show a drawn Demo store.
_Avoid_: Case study, client, project (as a name for a Demo store)

## Filmstrip

**Filmstrip**:
The scroll-driven section under the hero ("What I do", `#services`). Its stage holds still while the scroll steps through 4 Frames. The Frames fan around one center axis, the Timeline is above them, and the Chapters are below them. On phones and with reduced motion, the Frames are a still swipe row.
_Avoid_: Carousel, slider, slideshow

**Frame**:
One portrait screen of a Demo store in the Filmstrip. There are 4 Frames, in this order: the home page as it loads, a product with Add to cart, the speed score, and the call booking. One Frame at a time is the active Frame, in the center of the fan.
_Avoid_: Card, slide. Do not use "Frame" for one animation frame of the browser; say "animation frame".

**Chapter**:
The caption of one Frame: a heading, one line of text, and one link. The 4 Chapters tell who Luan is, what he builds, the free speed audit, and the call. Only the Chapter of the active Frame shows.
_Avoid_: Caption (as the name of the thing), step, slide text

**Timeline**:
The hairline rule above the Frames, with one timestamp per Frame (0.4 s, 0.9 s, 1.6 s, Call). The timestamp of the active Frame lights, and the timestamps before it show as done.
_Avoid_: Progress bar. The 4 steps of "How I work" are the process, not the Timeline.

## Offer

**Project builder**:
The "Build your project" section. The visitor switches services on and off, and each service that is on goes into the Project list. The 7 services are Store launch, Store fix, Care plan, Speed audit, Product import, Custom section, and Second language. The switches show no prices.
_Avoid_: Calculator, configurator, cart, Package (the old package table is gone)

**Project list**:
The card next to the switches of the Project builder. The page titles it "Your project". It shows the project strip (one equal segment per service that is on), one numbered line per service with no value, and a note. It has no total and no price: the price comes after a 15-minute call. When no service is on, it shows an empty state. Its Book a call link (`data-prefill`) fills the contact field "What do you need?" with "I am interested in:" and one "- <service>" line for each service.
_Avoid_: Project estimate (the old name), quote, invoice, order, cart

## Scroll

**Virtual scroll**:
The scroll of the page when JavaScript is on (the `vs-on` class on the root). The page itself does not scroll. Wheel, touch, and keys move a target, and each animation frame eases the page toward the target. The page loops: after the footer comes the top again, in both directions. With JavaScript off, the page scrolls normally.
_Avoid_: Smooth scroll, infinite scroll (alone), scroll hijack

**Twin copy**:
The second copy of the page that the Virtual scroll puts after the first copy, so that the end of the page flows into the start. It has no ids, no `for` or `aria-labelledby` links, and no tab stops, and it is hidden from assistive technology.
_Avoid_: Clone, duplicate, ghost page

**Page map**:
The hairline line under the nav that shows where the visitor is in the loop, with one tick per section. It replaces the scrollbar that the Virtual scroll hides.
_Avoid_: Scrollbar, progress bar, minimap
