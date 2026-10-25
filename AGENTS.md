# Portfolio

The freelance Home page of Luan Afonso, a Shopify developer, written in TypeScript with Vite (ADR 0005). Read `GLOSSARY.md` and use its terms.

## Commands

Use pnpm. `pnpm dev` (dev server), `pnpm build` (type check, then Vite build), `pnpm typecheck`, `pnpm lint` (Biome check), `pnpm format` (Biome fix), `pnpm test` (Vitest, one run), `pnpm size` (gzipped JS budget of 100 KB; run after `pnpm build`). Before you commit, `pnpm typecheck && pnpm lint && pnpm test` must pass.

## Deploy

The site is the GitHub Pages user site of `luanAfons0`, at https://luanafons0.github.io/. `.github/workflows/deploy.yml` builds and deploys each push to `main`. The repo is public, so commit no secret and no screenshot of another site. The Vite base is `/`.

## Commits and pull requests

Commits follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/):

- Subject: `<type>(<scope>): <summary>`. English, imperative, lowercase, no period, 72 characters or less. Types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci`, `chore`, `style`. The scope is optional and names the area: `home`, `copy`, `virtual-scroll`, `filmstrip`, `builder`, `contact`, `analytics`, `assets`, `ci`. Mark a breaking change with `!` after the type or scope.
- Body (optional): why the change was made, wrapped at 72 characters.
- Footer: one `Closes #<n>` line per issue the commit finishes.
- The message describes only the change. It has no `Co-Authored-By` trailer and no AI attribution.
- One logical change per commit.

Pull requests:

- Branch from `main` as `<type>/<short-slug>` (for example `feat/project-builder`). Base is `main`.
- Title: the Conventional Commits subject format, in English.
- Body: in English. One summary line, then one `-` bullet per change, naming the exact file, function, or behavior that changed (for example "the empty state of the Project list"). Then one `Closes #<n>` line per issue. Same attribution rule as commits.
- Label `enhancement`, assignee `@me`.
- Merge only when CI is green, with a merge commit (`gh pr merge --merge`), so each commit's `Closes #<n>` stays in the history.

## The mock is the rule

The approved mock, `.impeccable/mocks/ui-studio/freelance-home-no-prices.html`, is the rule for the Home page, and `.impeccable/mocks/ui-studio/demo-stores-a.html` is the rule for its Demo stores section: layout, type, colors, spacing, copy, motion, states, and behavior. The direction contract is `.impeccable/surfaces/impeccable-mocks-ui-studio-freelance-home-html.md` (it still describes the first mock, `freelance-home.html`, which the new mock replaced). When a ticket and the mock do not agree, the mock wins. When something is not in the mock, ask before you add it.

- The mock is a page fragment with no doctype, about 340 KB, with base64 images. Read it with `grep` and line ranges. Do not read the `data:` URIs.
- Keep every string in English and Portuguese word for word from the dictionary of the mock. When the build needs a new string, write it in the voice of the mock and list it in the pull request, so that Luan can check it.
- Show no service price on the page. Luan has no customers yet. The price comes after the call. Only the Demo store product prices show, and each one is labelled as a demo.
- The page has no Mock values now. A new one gets the dashed `.mock-note` on the page and a `MOCK VALUES` comment in the code, until Luan gives the real value.
- Label every Demo store and all demo data as a demo.
- `DESIGN.md` and `.impeccable/design.json` record the design system of the built page. The impeccable documenter writes them from the built page. Do not edit `.impeccable/` by hand.

## Code layout

- `index.html` is the Home page: the markup of the mock, in English, as static HTML, so all content shows with JavaScript off. The Project builder (the switches, the strip, and the lines of the Project list, with no prices) is in the HTML as the script of the mock first renders it (Store launch and Speed audit on). The booking days and the date of the Project list are empty until the script fills them. JavaScript adds the Virtual scroll (the `vs-on` class on the root and the Twin copy), as the mock does. `src/home/markup.test.ts` checks the markup with JavaScript off.
- `src/home/home.css`: all the styles of the mock, in the order of the mock, and the two `@font-face` rules. Biome turns off some CSS rules for it, and some a11y rules for `index.html`, because the mock is the rule (`overrides` in `biome.json`).
- `public/fonts/`: Geist and Geist Mono (Fontsource 5.3.0, Latin, variable), each with its OFL license. `index.html` preloads both.
- `public/photos/`: the Demo store photo of the Filmstrip. Each JPEG keeps the comment that names its origin; do not strip it. The footer credits its author.
- `public/demo-stores/`: the screen recordings of the three Demo stores (8 s MP4 loops, laptop and phone) and their posters. They are Luan's own stores, so they can be in the public repo. The footer says where the screens come from.
- `src/main.ts` is the home entry. It only calls `mountHome(document)`.
- `src/home/home.ts`: `mountHome(doc)`, the one seam of the Home page. It starts each part in the order of the mock, gives each part one `HomeContext` (`doc`, `win`, `signal`, `language`, `scroll`), and returns `dispose()`. `dispose()` aborts `signal`, and `signal` stops every listener, observer, animation frame loop, and timer. Do not edit `home.ts` to add a feature: each feature has its own file, and the mount already calls it.
- `src/home/copy.ts`: the EN and PT dictionaries of the mock, word for word (`T`), the `Lang` and `CopyKey` types, `STORAGE_KEY` (`la.lang`), and `translate(lang, key)`. A missing text falls back to English, then to the key.
- `src/home/offer.ts`: the order of the Project builder items (`PICKS`), the items that are on at the start (`DEFAULT_PICKS`), and the Demo store product price of the Filmstrip (`DEMO_PRICES`). It has no service prices.
- `src/home/format.ts`: the language of the page for the Demo store prices (`locale`, `inCurrency`, `fmt`): USD for English, BRL for Portuguese.
- `src/home/language.ts`: `createLanguage(doc, signal)`. It restores and saves the language, wires the EN/PT toggle, and sends `lang/<id>`. `apply()` puts the language on the whole page (the html `lang`, `[data-t]`, `[data-t-aria]`, `[data-t-ph]`, `[data-t-href]` (the LinkedIn links, `?locale=en-US` or `pt-BR`), `[data-demo-price]`, the pressed toggle, and the booking days), then runs each `onChange` function in the order that they were added. A storage error does not stop the page.
- `src/home/tracking.ts`: the `book-call` and `whatsapp` events, from one click listener on the document.
- `src/home/scroll.ts`: `mountScroll`, the Virtual scroll and the Twin copy, and the `Scroll` interface. It ports the `vs` part of the mock line for line. `src/home/page-map.ts`: `mountPageMap`, the Page map hook of the mock (the fill and one tick per section). Their tests fake the layout, the animation frames, and reduced motion with `src/home/test-support/layout.ts`. A test that reads the page as assistive technology does must not count the Twin copy (`.vs-copy[aria-hidden="true"]`).
- `src/home/builder.ts`: `mountBuilder`, the Project builder of the mock (`renderPicks`, `renderProject`, `fillMessage`, and the `[data-prefill]` links). The id queries find only the first copy. One `change` listener on `#picks` reads all the switches. A `[data-prefill]` link (Book a call, also in the Twin copy) fills the "What do you need?" field with "I am interested in:" and one "- <service>" line for each service that is on, then an empty line. The cursor goes to the end. A list that the builder put there before is replaced, and text that the visitor wrote stays. The field grows with its text and flashes once.
- `src/home/contact.ts`: `mountContact`, the `[data-copy]` buttons (the clipboard, or a text selection when the clipboard refuses) and the form (name, email, and message are necessary; the link is optional, but it must be `http(s)://host.tld`). A wrong field gets `aria-invalid` and the error under it, and the first wrong field gets the focus. A valid submit sends `form-ready`, then posts the form to Web3Forms (the `action` and the public `access_key` in `index.html`), which sends the message to Luan's inbox. The post is FormData with only an `Accept` header, so the browser sends no CORS preflight. While it sends, the button shows "Sending…". Success shows the sent state; a refusal or a network error shows `#e-send` and keeps the text. With JavaScript off, the browser checks the `required` fields and posts the form itself. Web3Forms refuses requests that do not come from a real browser (curl, headless Chromium), so test a real send with a normal browser user agent. As in the mock, a language change does not translate an error that shows.
- `src/home/showcase.ts`: `mountShowcase`, the Demo stores section, on each `[data-showcase]` (the page and the Twin copy). With JavaScript off, the three store cards stack and the store tiles stay hidden. With JavaScript, one card shows at a time (`is-on`; the others are `inert`), and the tiles (`role="tab"`) pick it by click, arrow keys, Home and End. A switch from the keyboard is instant. The tiles move on by themselves every 9 s while the section is in view, until the visitor picks a store or uses a card, and never with reduced motion. A recording plays only on screen, in the shown card, and never with reduced motion. In the Twin copy the tiles keep `tabIndex = -1`. The password Copy buttons are `[data-copy]` buttons of `contact.ts`: a button with icons changes only its `[data-t]` label and gets `is-done`.
- `src/home/filmstrip.ts`: `mountFilmstrip`, the Filmstrip of the mock (`setActive`, `observe`, and the frame hook that uses the reading line). When the strip is out of view, it goes at once (`.is-jump`) to the first Frame when the page comes from the top, and to the last Frame when the page comes back from below. In row mode (767px or less, or reduced motion), an IntersectionObserver on `.fan` picks the Frame. `#services` finds only the first copy.
- `src/home/test-support/page.ts`: `loadHomeBody()` puts the body of the real `index.html` in the test document and resets the root. `src/home/home.test.ts` mounts the page on it.
- `src/analytics/`: GoatCounter (see Analytics). `goatcounter-plugin.ts` is the `goatcounter` Vite plugin. It puts the GoatCounter script tag at the end of the head, in the production build only. `vite.config.ts` uses it.
- `public/favicon.svg`: the favicon.
- `scripts/check-size.mjs`: the gzipped JS size check of `pnpm size`. It fails when the build has no JavaScript.
- Tests sit next to the code as `*.test.ts` (and `scripts/*.test.mjs`). A test checks behavior through a public seam, never private functions or internal state. For the Home page, the seam is one function that mounts the page on the real `index.html` markup in happy-dom.
- The Twin copy has no ids, no `for` or `aria-labelledby` links, and no tab stops, and it is hidden from assistive technology. A test must check this.

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues on `luanAfons0/luanAfons0.github.io`, through the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`. ADRs 0001 to 0004 are about the removed game. ADR 0005 supersedes them.

## Analytics

`src/analytics/analytics.ts` holds the GoatCounter site code (`GOATCOUNTER_SITE`), the script tag, and `track(event)`. GoatCounter uses no cookies. `track` uses optional chaining and a `try`, so a blocked script never throws. `AnalyticsEvent` is the union of all the events of the spec (#51): `book-call` (a Book a call link, also the one of the Project list), `whatsapp` (the WhatsApp link of the hero), `lang/<id>` (the visitor changes the language; not on restore), and `form-ready` (a valid form submit). Send no other events. `analytics.ts` imports only types from `src/home/`.

## History

The first-person game is in git history. The tag `game-final` marks the last game commit on `main`.
