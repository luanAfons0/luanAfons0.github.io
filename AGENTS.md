# Portfolio

The freelance Home page of Luan Afonso, a Shopify developer, written in TypeScript with Vite (ADR 0005). Read `GLOSSARY.md` and use its terms.

## Commands

Use pnpm. `pnpm dev` (dev server), `pnpm build` (type check, then Vite build), `pnpm typecheck`, `pnpm lint` (Biome check), `pnpm format` (Biome fix), `pnpm test` (Vitest, one run), `pnpm size` (gzipped JS budget of 100 KB; run after `pnpm build`). Before you commit, `pnpm typecheck && pnpm lint && pnpm test` must pass.

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
- Body: in English. One summary line, then one `-` bullet per change, naming the exact file, function, or behavior that changed (for example "the empty state of the Project estimate"). Then one `Closes #<n>` line per issue. Same attribution rule as commits.
- Label `enhancement`, assignee `@me`.
- Merge only when CI is green, with a merge commit (`gh pr merge --merge`), so each commit's `Closes #<n>` stays in the history.

## The mock is the rule

The approved mock, `.impeccable/mocks/ui-studio/freelance-home.html`, is the rule for the Home page: layout, type, colors, spacing, copy, motion, states, and behavior. The direction contract is `.impeccable/surfaces/impeccable-mocks-ui-studio-freelance-home-html.md`. When a ticket and the mock do not agree, the mock wins. When something is not in the mock, ask before you add it.

- The mock is a page fragment with no doctype, about 350 KB, with base64 images. Read it with `grep` and line ranges. Do not read the `data:` URIs.
- Keep every string in English and Portuguese word for word from the dictionary of the mock. When the build needs a new string, write it in the voice of the mock and list it in the pull request, so that Luan can check it.
- Keep the Mock values marked (the dashed `.mock-note` on the page, the `MOCK VALUES` comment in the code) until Luan gives the real values.
- Label every Demo store and all demo data as a demo.
- `DESIGN.md` and `.impeccable/design.json` still describe the removed game. Do not follow them. Ticket #59 makes them again from the built page. Do not edit `.impeccable/`.

## Code layout

- `index.html` is the Home page. Now it is a placeholder. Its markup is static HTML, so all content shows with JavaScript off. JavaScript adds the Virtual scroll (the `vs-on` class on the root and the Twin copy), as the mock does.
- `src/main.ts` is the home entry. Now it is empty.
- `src/analytics/`: GoatCounter (see Analytics). `goatcounter-plugin.ts` is the `goatcounter` Vite plugin. It puts the GoatCounter script tag at the end of the head, in the production build only. `vite.config.ts` uses it.
- `public/favicon.svg`: the favicon.
- `scripts/check-size.mjs`: the gzipped JS size check of `pnpm size`. It fails when the build has no JavaScript.
- Tests sit next to the code as `*.test.ts` (and `scripts/*.test.mjs`). A test checks behavior through a public seam, never private functions or internal state. For the Home page, the seam is one function that mounts the page on the real `index.html` markup in happy-dom.
- The Twin copy has no ids, no `for` or `aria-labelledby` links, and no tab stops, and it is hidden from assistive technology. A test must check this.

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues on `luanAfons0/portfolio`, through the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`. ADRs 0001 to 0004 are about the removed game. ADR 0005 supersedes them.

## Analytics

`src/analytics/analytics.ts` holds the GoatCounter site code (`GOATCOUNTER_SITE`), the script tag, and `track(event)`. GoatCounter uses no cookies. `track` uses optional chaining and a `try`, so a blocked script never throws. The Home page sends no events yet. `AnalyticsEvent` is a string until then; make it a union of the event names when the page gets them. The spec (#51) lists these events: Book a call clicks, the WhatsApp link, a language change (`lang/<id>`), Add to project (`add/<package>`), and a valid form submit (`form-ready`). Send no other events.

## History

The first-person game is in git history. The tag `game-final` marks the last game commit on `main`.
