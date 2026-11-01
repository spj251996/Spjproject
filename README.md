# SF Wedding

A single-page wedding invitation for Sebastian and Flemy, covering their betrothal and their wedding.

Guests open one link and scroll one page:

- **Invitation** — the couple's names, the blessing and the dates.
- **Event Info** — each event's date, time and place, with a map link to get there.
- **Family** — the families of the bride and groom.
- **Celebrations & Gallery** — the rituals, and their photographs once each has taken place.
- **Wishes** — a closing verse and the families' sign-off.

The page is built for phones first, for guests of every age and on slow connections: everything a
guest needs is visible without tapping anything, and photographs never slow the event details down.
Venues, dates and times live in `content/`, not in this README.

## Stack

| Concern | Choice |
| --- | --- |
| Language | TypeScript |
| Framework | Next.js, App Router, static export |
| Styling | Tailwind CSS |
| Animation | CSS and plain scripts, no animation library |
| Content | Typed TypeScript modules under `content/`, each checked by a validator |
| Lint and format | Biome, which fully replaces ESLint and Prettier |
| Hosting | Vercel |
| Images | AVIF and WebP generated from `assets/` by a committed script (`npm run images`) |

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
build instead of reaching a page. `npm run build` runs `prebuild` first, which executes the validators
and checks that every referenced image exists on disk. Run that check alone with
`npm run validate:content`.

## Development-only pages

Two pages are built only by `npm run dev` and on Vercel preview deploys — never in the production
build, so guests never receive them:

- `/design-system` — a visual reference of the design system's tokens and components.
- `/thread` — a design study of the invitation with an animated red thread running down the page. It
  is not part of the invitation.

## Project structure

```
app/                    Routes, layout and global styles
components/             React components, grouped by layer
content/                Typed content modules and their validators
assets/                 Source art the generators read
scripts/                Generators and checks (layout fits, images, export checks)
public/                 Static assets served as-is
legacy-html/            The earlier static-HTML version — kept for reference, not served
```

Generated files (layout fits, frame stylesheets, thread paths, delivered images) are never edited by
hand — re-run their generator.

## Deployment

Ships as a fully static export (`output: "export"` in `next.config.ts`) to Vercel — no server runtime.
