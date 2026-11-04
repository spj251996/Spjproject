/* THE TWIST — the ink carries the lay of a long-lay rope: lighter gaps slanting across it at a steady
   pitch, so the line reads as twisted fibre rather than a pen stroke (DESIGN.md -> Thread -> The
   twist). Geometry, built once per measure from each piece's own samples; a frame only shows whole
   chunks the ink has already passed, so a gap never shows ahead of the ink and stays shown once it has,
   and a piece's own `d` and dash are never touched. No filter of its own: it sits inside the ink's
   shadow, and a filter here would be a second page-length buffer. */
import type { ThreadPiece } from "./thread-line.ts";
import { pieceProgress } from "./thread-progress.ts";
import { frameAt, type PieceSamples, samplePath } from "./thread-samples.ts";
import { tokenLength } from "./thread-tokens.ts";

const SVG_NS = "http://www.w3.org/2000/svg";

/* The rope, measured off a long-lay rope reference and rounded on a render: the strand pitch as a
   multiple of the cord's width, the gap as a share of the pitch, the gap's slant to the line, how far
   each gap bows, and how much lighter than the ink the gap is (OKLCH lightness — the colour itself is
   `--color-thread-twist`). */
export const ROPE = {
  pitch: 1.94,
  gap: 0.2,
  slant: 28,
  bow: 0.4,
  lighter: 0.18,
} as const;

/* At the rope's own ratios a gap on a thin line is below a pixel, so it paints almost nothing. The
   pitch and slant hold; only the gap's width is held at least this, about two device pixels on a
   phone. */
export const GAP_FLOOR = 0.6;
/* Px of arc per shown/hidden group: short, so a chunk shows soon after the ink passes it. */
export const MARK_CHUNK = 12;

/* One gap between two strands, centred at `s`, across the line from -half to half, leaning `lean` px
   along the line over that span. Bowed a little: a strand's end is rounded, so the gap between two is
   a shallow crescent. */
function gapAt(
  samples: PieceSamples,
  s: number,
  half: number,
  lean: number,
  bow: number,
) {
  const { x, y, tx, ty } = frameAt(samples, s);
  const nx = -ty;
  const ny = tx;
  const p = (along: number, across: number) =>
    `${(x + tx * along + nx * across).toFixed(2)} ${(y + ty * along + ny * across).toFixed(2)}`;
  return `M${p(-lean / 2, -half)}Q${p(bow * half * 2, 0)} ${p(lean / 2, half)}`;
}

/* Every gap whose centre lies in [from, to), none within one cord width of either end. */
export function ropeGaps(
  samples: PieceSamples,
  from: number,
  to: number,
  length: number,
  half: number,
) {
  const pitch = ROPE.pitch * half * 2;
  const lean = (half * 2) / Math.tan((ROPE.slant * Math.PI) / 180);
  let d = "";
  for (let at = Math.ceil(from / pitch) * pitch; at < to; at += pitch) {
    if (at < half * 2 || at > length - half * 2) continue;
    d += gapAt(samples, at, half, lean, ROPE.bow);
  }
  return d;
}

/* How wide a gap's stroke is, ACROSS the gap: its share of the pitch, measured along the line,
   projected onto the gap's own normal. */
export function gapWidth(half: number) {
  const along = ROPE.gap * ROPE.pitch * half * 2;
  return Math.max(GAP_FLOOR, along * Math.sin((ROPE.slant * Math.PI) / 180));
}

/* Whether a chunk ending at `end` px shows once the ink has reached `reached` px of its piece. */
export function chunkShown(end: number, reached: number) {
  return reached >= end - 0.01;
}

/* One `<g data-thread-twist>` per `<svg>`, inserted before `before` so it sits over the ink and under
   the light. A tapered piece's gaps are cut by the taper's own mask, as its ink is: full-width gaps
   there would stand wider than the line they sit on. */
export function createTwistPainter(
  svg: SVGSVGElement,
  before: Element | null,
  cutId: string,
  taperPiece: (count: number) => number,
) {
  const layer = document.createElementNS(SVG_NS, "g");
  layer.dataset.threadTwist = "rope";
  svg.insertBefore(layer, before);
  let pieces: readonly ThreadPiece[] = [];
  let chunks: { element: SVGPathElement; end: number }[][] = [];

  return {
    measured(
      inks: readonly (SVGPathElement | null)[],
      next: readonly ThreadPiece[],
      baseOf: (path: SVGPathElement) => string,
    ) {
      layer.replaceChildren();
      pieces = next;
      chunks = [];
      const half = tokenLength("--stroke-thread") / 2;
      next.forEach((piece, index) => {
        const ink = inks[index];
        if (ink === null || ink === undefined) return;
        const length = piece.end - piece.start;
        const holder = document.createElementNS(SVG_NS, "g");
        if (index === taperPiece(next.length))
          holder.setAttribute("mask", `url(#${cutId})`);
        layer.append(holder);
        const samples = samplePath(baseOf(ink), length);
        const own: { element: SVGPathElement; end: number }[] = [];
        for (let from = 0; from < length; from += MARK_CHUNK) {
          const end = Math.min(length, from + MARK_CHUNK);
          const d = ropeGaps(samples, from, end, length, half);
          if (d === "") continue;
          const element = document.createElementNS(SVG_NS, "path");
          element.setAttribute("fill", "none");
          element.setAttribute("stroke-linecap", "butt");
          element.style.stroke = "var(--color-thread-twist)";
          element.style.strokeWidth = `${gapWidth(half).toFixed(2)}px`;
          element.setAttribute("d", d);
          element.style.display = "none";
          holder.append(element);
          own.push({ element, end });
        }
        chunks[index] = own;
      });
    },
    painted(drawn: number) {
      pieces.forEach((piece, index) => {
        const length = piece.end - piece.start;
        const reached = Math.min(length, pieceProgress(drawn, piece) * length);
        for (const chunk of chunks[index] ?? []) {
          const value = chunkShown(chunk.end, reached) ? "" : "none";
          if (chunk.element.style.display !== value)
            chunk.element.style.display = value;
        }
      });
    },
  };
}
