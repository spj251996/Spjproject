# SF Wedding

A single-page wedding invitation for Flemy and Sebastian, covering a betrothal and a
wedding. Venues, dates and times live in the content modules, not here.

Guests get event facts up front, with zero interaction cost, plus a growing photo record of the
celebration as each ritual completes. The red thread is an exploration at `/thread`, not part of the
invitation.

## Stack

| Concern | Choice |
| --- | --- |
| Language | TypeScript |
| Framework | Next.js, App Router, static export |
| Styling | Tailwind CSS |
| Animation | CSS and plain scripts, no animation library |
| Content | Typed TypeScript modules under `content/`, each exported through its validator |
| Lint and format | Biome, which fully replaces ESLint and Prettier |
| Hosting | Vercel |
| Images | Generated from `assets/` by a committed script (`npm run images`; AVIF + WebP); `next/image` (unoptimized) for portraits, bare `<img>` for the ritual photographs |

## Requirements

Node **>=22.18 <23**, as in `package.json` `engines` (22.18 is the floor the type-stripped scripts
need). A local Node outside that range warns on install (`EBADENGINE`) and otherwise works.

## Getting started

```bash
npm install
npm run images -- --only=rituals  # one-time: writes the gitignored ritual photo manifest
npm run dev
```

The dev server serves http://localhost:3000.

```bash
npm run build     # static export to out/, after validating content
npm run test      # node --test suite: content, components, app and scripts
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
assets/                 Source art the generators read
scripts/                Generators and gates (fits, frames, images, export checks)
public/                 Static assets served as-is
legacy-html/            Archived pre-Next.js static-HTML build — reference-only, not served
```

Generated files (the fits, the frame sheets, the thread paths, the image deliveries) are never
hand-edited — re-run their generator.

## Deployment

Ships as a fully static export (`output: "export"` in `next.config.ts`) to Vercel — no server runtime.
