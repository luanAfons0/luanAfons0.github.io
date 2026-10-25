# Luan Afonso, Shopify developer

The portfolio of Luan Afonso, a freelance Shopify developer from Brazil. I build and fix online stores.

**Live site:** https://luanafons0.github.io/

## What is on the page

The site is one page, in English and Portuguese:

- **How I work:** the steps from the first call to launch day.
- **Demo stores:** three real Shopify development stores (Café Serra, Ateliê Lume, Orvalho), each one marked as a demo. Each card opens the store and gives its password.
- **Questions:** short answers to common questions.
- **Build your project:** switch on the services you need. "Book a call" then writes the list into the contact form.
- **Tell me about your store:** a contact form that sends the message to my inbox, plus WhatsApp, email, and LinkedIn.

The page shows no service prices. The price comes after a free 15-minute call.

## How it is built

- **TypeScript and Vite**, with no UI framework. The JavaScript is about 10 KB gzipped, and a check in CI keeps it under 100 KB.
- **The content is static HTML.** All text, images, and the form work with JavaScript off. JavaScript adds the motion and the interactions.
- **A Virtual scroll:** the page moves on a track with eased motion and loops from the end back to the start. Every frame snaps to whole device pixels, so the page does not shake.
- **Reduced motion:** with `prefers-reduced-motion`, the animations stop, the scroll has no easing, and the Filmstrip shows its Frames in a row.
- **Two languages:** the EN/PT toggle changes all text, labels, and links, and the page keeps the choice.
- **The contact form** posts to [Web3Forms](https://web3forms.com/). It checks each field and shows a clear error.
- **Analytics:** [GoatCounter](https://www.goatcounter.com/), with no cookies.
- **Self-hosted fonts:** Geist and Geist Mono, with no Google Fonts.
- **Tests:** about 130 tests in Vitest with happy-dom. They mount the page on the real `index.html`.

## Run it

You need Node.js 24 or newer and pnpm.

```sh
pnpm install
pnpm dev        # dev server
pnpm test       # tests
pnpm lint       # Biome check
pnpm build      # type check, then build into dist/
pnpm size       # gzipped JS size check (run after build)
```

Each push to `main` runs the checks and deploys the site to GitHub Pages (`.github/workflows/deploy.yml`).

## Project layout

| Path | What it holds |
| --- | --- |
| `index.html` | The page markup, in English |
| `src/home/` | One file for each part of the page (scroll, builder, contact, filmstrip, language), with its tests |
| `src/analytics/` | GoatCounter and its events |
| `public/` | Fonts, photos, and the favicon |
| `docs/adr/` | Architecture decision records |
| `AGENTS.md` | The rules for working on this repo |

## History

The first version of this repo was a Doom-style raycaster game in TypeScript. The tag [`game-final`](https://github.com/luanAfons0/luanAfons0.github.io/tree/game-final) marks its last commit. ADR 0005 explains why the freelance page replaced it.

## Credits

- Fonts: [Geist and Geist Mono](https://vercel.com/font) by Vercel, under the SIL Open Font License.
- The Filmstrip photo comes from Wikimedia Commons. The footer of the site credits its author and license.
- The store screens are recordings of my demo stores, whose photos come from Unsplash and Pexels.

## Contact

- Email: luan.hmatao@gmail.com
- LinkedIn: https://www.linkedin.com/in/luan-henrique-afonso/
- Or use the form on the [site](https://luanafons0.github.io/#contact).
