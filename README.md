# SF Wedding

A single-page, red-thread wedding invitation for Sebastian and Flemy, covering an engagement (Calicut)
and a wedding (Ernakulam).

Guests get event facts up front, with zero interaction cost, plus a growing photo record of the
celebration as each ritual completes. A single continuous scroll-driven thread ties the page together as
one narrative rather than stacked sections.

## Stack

| Concern | Choice |
| --- | --- |
| Language | TypeScript |
| Framework | Next.js, App Router, static export |
| Styling | Tailwind CSS |
| Animation | Framer Motion + CSS |
| Content | Static JSON / Markdown (rituals, photos) |
| Hosting | Vercel |
| Images | `next/image` |

## Getting started

```bash
npm install
npm run dev     # start the dev server — http://localhost:3000
```

```bash
npm run build   # production static export → out/
npm run lint    # lint
```

## Project structure

```
app/                    Next.js App Router routes and layout
public/                 Static assets served as-is
.claude/docs/           Project docs (see below)
legacy-html/            Archived pre-Next.js static-HTML build — reference-only, not served
```

## Docs

Scope, build order, and design system live in `.claude/docs/`:

- [`PROJECT.md`](.claude/docs/PROJECT.md) — what the site is and why: audience, scope, requirements, non-goals.
- [`IMPLEMENTATION-PLAN.md`](.claude/docs/IMPLEMENTATION-PLAN.md) — build order, phases, and the gate that closes each one.
- [`DESIGN.md`](.claude/docs/DESIGN.md) — tokens, foundations, and components; the single source of truth for every visual value.

## Deployment

Ships as a fully static export (`output: "export"` in `next.config.ts`) to Vercel — no server runtime.
