/* Pure, server-safe geometry for `page-thread.tsx`'s whole-page no-JS fallback. Split out of
   `page-thread.tsx` because that file is `"use client"` — every export of a client module is a
   client boundary, so a server component cannot call a function defined there even when the
   function itself touches no DOM. Nothing in this file does: it is the same identity-warp
   arithmetic `thread-line.test.ts` already proves reproduces the authored geometry exactly. The
   fallback below is itself server-rendered. */

import { authoredCard } from "./thread-authored-layout.ts";
import { aspectQuery, type BandId, THREAD_BANDS } from "./thread-bands.ts";
import { sectionBox } from "./thread-boxes.ts";
import { threadLine } from "./thread-line.ts";
import { THREAD_IDS } from "./thread-paths.ts";
import type { MeasuredSection } from "./thread-warp.ts";

const PATH_TOKEN = /[A-Za-z]|-?\d*\.?\d+(?:[eE][-+]?\d+)?/g;

/* An IDENTITY warp (a band's own authored card/section figures as both `from` and `to`) reproduces
   the authored geometry exactly (`thread-line.test.ts`'s own identity test) — what every static,
   script-free render of this page (the no-JS fallback) draws from. */
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
