# SF Wedding

A single-page, red-thread wedding invitation for Flemy and Sebastian, covering a betrothal and a
wedding. Venues, dates and times live in the content modules, not here.

Guests get event facts up front, with zero interaction cost, plus a growing photo record of the
celebration as each ritual completes. A single continuous scroll-driven thread ties the page together as
one narrative rather than stacked sections.

## Stack

| Concern | Choice |
| --- | --- |
| Language | TypeScript |
| Framework | Next.js, App Router, static export |
| Styling | Tailwind CSS |
| Animation | CSS only — scroll-driven animations and transitions; no animation library is installed |
| Content | Typed TypeScript modules under `content/`, each exported through its validator |
| Lint and format | Biome, which fully replaces ESLint and Prettier |
| Hosting | Vercel |
| Images | Generated from `assets/` by `npm run images`; AVIF with a WebP fallback |

## Requirements

Node 22.18 or newer, as pinned in `package.json`. The `prebuild` step runs a TypeScript file directly,
which earlier 22.x releases reject with `ERR_UNKNOWN_FILE_EXTENSION`.

## Getting started

```bash
npm install
npm run dev
```

The dev server serves http://localhost:3000.

```bash
npm run build     # static export to out/, after validating content
npm run test      # content model and validator tests
npm run lint      # Biome
npm run format    # Biome, writing in place
```

## Content

Content lives in `content/` as typed modules rather than data files, so a malformed entry fails the
build instead of reaching a page. Each module exports through its validator, and `npm run build` runs
`prebuild` first, which executes those validators and checks that every referenced asset exists on disk.
Run that check alone with `npm run validate:content`.

## Project structure

```
app/                    Next.js App Router routes, layout and global styles
components/             React components, grouped by layer
content/                Typed content modules and their validators
public/                 Static assets served as-is
legacy-html/            Archived pre-Next.js static-HTML build — reference-only, not served
```

## Deployment

Ships as a fully static export (`output: "export"` in `next.config.ts`) to Vercel — no server runtime.
