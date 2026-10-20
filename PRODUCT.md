# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Owners of small and mid-size online stores, in Brazil and in other countries. They want a developer to build or fix a Shopify store. They have little time and want to know fast what Luan does, what it costs, and how to book a call. Many of them open the page on a phone.

## Product Purpose

The freelance Home page of Luan Afonso, a Shopify developer: "The Store Audit" (ADR 0005). The visitor reads the offer in one line, watches a Demo store load through the 4 Frames of the Filmstrip, sees the Packages as a report table with from-prices, builds a Project estimate, sees the process and the Demo stores, and books a call. Success: the visitor books a call or writes on WhatsApp.

## Positioning

The page reads as the audit that Luan sends to a store owner: a store measured Frame by Frame, then fixed, priced, and booked. It is not a dark freelancer template, and it is not a cream editorial portfolio.

## Operating Context

- Desktop and phone. The Frames are a swipe row on phones.
- With JavaScript on, the Virtual scroll moves the page and loops from the footer back to the top. The Page map under the nav replaces the scrollbar.
- With JavaScript off, the page shows all content and scrolls normally.
- English and Portuguese (pt-BR), with a switch in the nav. Prices are in USD in English and in BRL in Portuguese. The page saves the language choice.
- Light only. There is no Theme and no dark mode.

## Capabilities and Constraints

- TypeScript and Vite, no framework. The page markup is static HTML in `index.html`.
- Gzipped JS budget of 100 KB.
- The approved mock (`.impeccable/mocks/ui-studio/freelance-home.html`) is the rule for layout, type, colors, spacing, copy (English and Portuguese, word for word), motion, states, and behavior. Ask before you add something that is not in the mock.
- Glossary terms are binding: Home page, Mock value, Demo store, Filmstrip, Frame, Chapter, Timeline, Package, Project builder, Project estimate, Virtual scroll, Twin copy, Page map (see `GLOSSARY.md`).
- Keyboard navigation and `prefers-reduced-motion` must work.
- Analytics: GoatCounter, with no cookies.
- Photos must carry a free license with credits.

## Brand Commitments

- Name: Luan Afonso.
- Voice: plain, direct, and calm. Short sentences. No hype.

## Evidence on Hand

- Luan has no client work yet. The Demo stores, the demo metrics, and the audits are samples, and the page labels each one as a demo. Never invent clients, results, dates, or metrics.
- Prices, the WhatsApp number, the email, and the booking link are Mock values until Luan gives the real ones.
- Source code: https://github.com/luanAfons0/portfolio. GitHub profile: https://github.com/luanAfons0.

## Product Principles

1. The visitor can book a call from every screen.
2. Every demo says it is a demo; every Mock value stays marked.
3. A price is a from-price or an estimate, never a quote. The fixed price comes after a 15-minute call.
4. Fast to load, fast to read.
