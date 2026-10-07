/* Pure, server-safe geometry for `page-thread.tsx`'s whole-page no-JS fallback. Split out of
   `page-thread.tsx` because that file is `"use client"` — every export of a client module is a
   client boundary, so a server component cannot call a function defined there even when the
   function itself touches no DOM. Nothing in this file does: it is the same identity-warp
   arithmetic `thread-line.test.ts` already proves reproduces the authored geometry exactly.

   It also carried `sectionRouteFallback` — one section's route, renormalised against its own
   authored card — which `not-found-thread.tsx` used for a closed replay of `invite`'s route. Both
   were retired on 2026-10-07 along with that screen's thread (DESIGN.md -> Not found). The split
   still earns its place: the fallback below is itself server-rendered. */

import { authoredCard } from "./thread-authored-layout";
import { type BandId, THREAD_BANDS } from "./thread-bands";
import { sectionBox } from "./thread-boxes";
import { threadLine } from "./thread-line";
import { MOTIF_PLACEMENTS, THREAD_IDS, THREAD_PATHS } from "./thread-paths";
import type { MeasuredSection } from "./thread-warp";

const PATH_TOKEN = /[A-Za-z]|-?\d*\.?\d+(?:[eE][-+]?\d+)?/g;

/* `threadLine` emits exactly one `M ...` subpath per connector and per motif (asserted in
   `thread-line.test.ts`), so splitting on an `M` boundary and counting is exact. */
export function splitSubpaths(d: string): string[] {
  return d.split(/(?=M )/).filter((s) => s.trim().length > 0);
}

function subpathCount(band: BandId, id: (typeof THREAD_IDS)[number]): number {
  return THREAD_PATHS[band][id].length + MOTIF_PLACEMENTS[band][id].length;
}

/* The index range, in the FLATTENED subpath list `threadLine` emits, that belongs to one section —
   `THREAD_IDS` order is the same connection order `threadLine` composes in. */
export function subpathRange(
  band: BandId,
  id: (typeof THREAD_IDS)[number],
): { start: number; end: number } {
  const index = THREAD_IDS.indexOf(id);
  let start = 0;
  for (let i = 0; i < index; i++) start += subpathCount(band, THREAD_IDS[i]);
  return { start, end: start + subpathCount(band, id) };
}

/* An IDENTITY warp (a band's own authored card/section figures as both `from` and `to`) reproduces
   the authored geometry exactly (`thread-line.test.ts`'s own identity test) — what every static,
   script-free render on this page (the no-JS fallback, and the whole of `not-found`) draws from. */
export function authoredMeasuredSections(band: BandId): MeasuredSection[] {
  let top = 0;
  return THREAD_IDS.map((id) => {
    const card = authoredCard(id, band);
    const box = sectionBox(id, band);
    const section: MeasuredSection = {
      top,
      height: box.height,
      cardLeft: card.cardLeft,
      cardWidth: card.cardWidth,
    };
    top += box.height;
    return section;
  });
}

/* Rounded to 6 decimals, `thread-warp.ts`'s own convention (`formatNumber`) -- a normalised 0-1
   coordinate needs nowhere near IEEE 754's ~17 significant digits to stay sub-pixel exact at any
   real viewport, and emitting the full float noise multiplies a path's size by roughly 2.5x for
   nothing. */
function formatNumber(value: number): string {
  return String(Math.round(value * 1e6) / 1e6);
}

export function normalise(d: string, width: number, height: number): string {
  const tokens = d.match(PATH_TOKEN) ?? [];
  let index = 0;
  const out: string[] = [];
  while (index < tokens.length) {
    const token = tokens[index];
    if (/^[A-Za-z]$/.test(token)) {
      out.push(token);
      index++;
      continue;
    }
    const x = Number(tokens[index++]);
    const y = Number(tokens[index++]);
    out.push(formatNumber(x / width), formatNumber(y / height));
  }
  return out.join(" ");
}

function round(value: number): string {
  const fixed = value.toFixed(5).replace(/\.?0+$/, "");
  return fixed === "-0" ? "0" : fixed;
}

/* Bounded ranges, never open-ended, so no aspect can match two bands — the same rule
   `thread-bands.ts` states and the same one a stale rule in this project once got bitten by
   (Tailwind orders arbitrary variants by string, so an open `>=64rem` beat an open `>=100rem`). */
export function aspectQuery(min: number, max: number): string {
  if (min === 0) return `(aspect-ratio < ${round(max)})`;
  if (max === Number.POSITIVE_INFINITY) {
    return `(${round(min)} <= aspect-ratio)`;
  }
  return `(${round(min)} <= aspect-ratio < ${round(max)})`;
}

export type Fallback = { band: BandId; d: string; media: string };

/* The whole page's no-JS fallback: every section, stacked, normalised into one 0-1 square per band
   so all three can share one viewBox. */
export const PAGE_FALLBACKS: Fallback[] = THREAD_BANDS.map((band) => {
  const sections = authoredMeasuredSections(band.id);
  const { d } = threadLine(band.id, sections);
  const totalHeight = sections.reduce((sum, s) => sum + s.height, 0);
  return {
    band: band.id,
    d: normalise(d, band.box.width, totalHeight),
    media: aspectQuery(band.min, band.max),
  };
});
