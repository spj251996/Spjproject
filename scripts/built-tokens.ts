/* Token readers and head fixtures shared by the thread's test files (`thread-head.test.ts`,
   `thread-retrace.test.ts`, `thread-taper.test.ts`): each reads the source stylesheet or the built
   export, so the tests carry no copy of a token value. */

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import {
  HEAD_LENGTH_RATIO,
  HEAD_TIP_MARGIN,
  type HeadOptions,
  type HeadSegment,
  type Rgb,
} from "../components/thread/thread-head.ts";

export const tokens = readFileSync("app/styles/tokens.css", "utf8");

export function tokenValue(name: string): string {
  const match = tokens.match(new RegExp(`--${name}:\\s*([^;]+);`));
  assert.ok(match, `--${name} not found in tokens.css`);
  return match[1].replace(/\s+/g, " ").trim();
}

export function colourToken(name: string): Rgb {
  const hex = tokenValue(name);
  assert.match(hex, /^#[0-9a-f]{6}$/, `--${name} is not a six-digit hex`);
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

export function pxToken(name: string): number {
  const value = tokenValue(name);
  assert.match(value, /^[\d.]+px$/, `--${name} is not a px length`);
  return Number.parseFloat(value);
}

export const BASE_WIDTH = pxToken("stroke-thread");
export const OPTIONS: HeadOptions = {
  length: HEAD_LENGTH_RATIO * BASE_WIDTH,
  tipWidth: pxToken("stroke-thread-head"),
  baseWidth: BASE_WIDTH,
  tailColor: colourToken("color-thread-red"),
  midColor: colourToken("color-thread-vermilion"),
  tipColor: colourToken("color-thread-core"),
};
/* How far the tip step reaches past the ink's tip: half the ink's width, so its round cap is covered,
   plus the margin that keeps the two edges from sharing a pixel. */
export const COVER = BASE_WIDTH / 2 + HEAD_TIP_MARGIN;

export const butts = (segments: readonly HeadSegment[]) =>
  segments.filter((segment) => segment.cap === "butt");

/* The head's colours and widths are read from the built stylesheet at runtime, so the component
   carries no copy of a token value to diverge from the token — the way a hand-edited JS constant
   once did. This pins that against the BUILT artifact, not the source: the built CSS defines every
   token, and the built script reads them by name and carries no literal in their place. It needs an
   export (`npm run build`), and says so rather than passing without one. */
export function builtChunks(extension: string): string {
  const dir = "out/_next/static/chunks";
  return readdirSync(dir)
    .filter((name) => name.endsWith(extension))
    .map((name) => readFileSync(`${dir}/${name}`, "utf8"))
    .join("\n");
}
