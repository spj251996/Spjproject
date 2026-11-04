import assert from "node:assert/strict";
import test from "node:test";
import { THREAD_BANDS } from "./thread-bands.ts";
import {
  CROSSING_MIN_GAP,
  findCrossings,
  orderCrossings,
  WEAVE_TOLERANCE,
} from "./thread-crossings.ts";
import { authoredMeasuredSections } from "./thread-fallback.ts";
import type { MotifId } from "./thread-geometry.ts";
import { splitSubpaths, threadLine } from "./thread-line.ts";
import { MOTIFS } from "./thread-motifs.ts";
import { samplePath } from "./thread-samples.ts";

/* Every crossing inside a motif, at every band and at each of `scales` times its sections, as fractions
   of that motif piece's length. A motif's weave is stored once, so it has to name every crossing its
   drawing has at any size. */
function motifCrossings(scales: readonly number[] = [1]) {
  const found: {
    band: string;
    kind: MotifId;
    first: number;
    second: number;
  }[] = [];
  for (const band of THREAD_BANDS)
    for (const scale of scales) {
      const line = threadLine(
        band.id,
        authoredMeasuredSections(band.id).map((section) => ({
          ...section,
          top: section.top * scale,
          height: section.height * scale,
          cardLeft: section.cardLeft * scale,
          cardWidth: section.cardWidth * scale,
        })),
      );
      const subpaths = splitSubpaths(line.d);
      const samples = line.pieces.map((piece, index) =>
        samplePath(subpaths[index], piece.end - piece.start),
      );
      for (const crossing of findCrossings(
        samples,
        line.pieces,
        CROSSING_MIN_GAP * 2.2,
      )) {
        const piece = line.pieces[crossing.first.piece];
        if (crossing.first.piece !== crossing.second.piece) continue;
        if (piece.kind === "connector") continue;
        const length = piece.end - piece.start;
        found.push({
          band: band.id,
          kind: piece.kind,
          first: crossing.first.at / length,
          second: crossing.second.at / length,
        });
      }
    }
  return found;
}

/* A window larger or smaller than its band's box scales every motif with its section, and a crossing whose
   two passes lie close along the line splits in two or merges as it does. */
const WINDOW_SCALES = [0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5];

const near = (
  a: { first: number; second: number },
  b: { first: number; second: number },
) =>
  Math.max(Math.abs(a.first - b.first), Math.abs(a.second - b.second)) <=
  WEAVE_TOLERANCE;

test("every crossing inside a motif, at every band, has its weave entry", () => {
  for (const crossing of motifCrossings()) {
    const entry = MOTIFS[crossing.kind].weave.find((candidate) =>
      near(candidate, crossing),
    );
    assert.ok(
      entry,
      `${crossing.kind} at ${crossing.band}: no weave entry near ${crossing.first.toFixed(3)} / ${crossing.second.toFixed(3)}`,
    );
  }
});

/* An entry orders the crossing it is nearest (`orderCrossings`), so an entry that is only ever the
   second-nearest orders nothing at any size. */
test("every weave entry is the nearest entry to a crossing the motif has at some size", () => {
  const found = motifCrossings(WINDOW_SCALES);
  const distance = (
    a: { first: number; second: number },
    b: { first: number; second: number },
  ) => Math.max(Math.abs(a.first - b.first), Math.abs(a.second - b.second));
  for (const [kind, motif] of Object.entries(MOTIFS)) {
    for (const entry of motif.weave) {
      const ordered = found.some((crossing) => {
        if (crossing.kind !== kind || !near(entry, crossing)) return false;
        return motif.weave.every(
          (other) => distance(other, crossing) >= distance(entry, crossing),
        );
      });
      assert.ok(
        ordered,
        `${kind}: weave entry ${entry.first} / ${entry.second} orders no crossing at any size`,
      );
      assert.ok(entry.first < entry.second);
      assert.ok(entry.over === "first" || entry.over === "second");
    }
  }
});

/* The weave is read at every size a band's windows reach, not only the authored one: every crossing inside a
   motif must be ordered by an entry of its own. */
test("at every size a band's windows reach, every crossing inside a motif takes an entry of its own", () => {
  const unordered: string[] = [];
  for (const band of THREAD_BANDS) {
    for (const scale of WINDOW_SCALES) {
      const sections = authoredMeasuredSections(band.id).map((section) => ({
        ...section,
        top: section.top * scale,
        height: section.height * scale,
        cardLeft: section.cardLeft * scale,
        cardWidth: section.cardWidth * scale,
      }));
      const line = threadLine(band.id, sections);
      const subpaths = splitSubpaths(line.d);
      const samples = line.pieces.map((piece, index) =>
        samplePath(subpaths[index], piece.end - piece.start),
      );
      const ordered = orderCrossings(
        findCrossings(samples, line.pieces, CROSSING_MIN_GAP * 2.2),
        line.pieces,
        (motif) => MOTIFS[motif].weave,
      );
      for (const crossing of ordered) {
        const piece = line.pieces[crossing.first.piece];
        if (crossing.first.piece !== crossing.second.piece) continue;
        if (piece.kind === "connector" || crossing.woven) continue;
        const length = piece.end - piece.start;
        unordered.push(
          `${piece.kind} at ${band.id} x${scale}: ${(crossing.first.at / length).toFixed(4)} / ${(crossing.second.at / length).toFixed(4)}`,
        );
      }
    }
  }
  assert.deepEqual([...new Set(unordered)], []);
});
