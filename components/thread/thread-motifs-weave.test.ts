import assert from "node:assert/strict";
import test from "node:test";
import { THREAD_BANDS } from "./thread-bands.ts";
import {
  CROSSING_MIN_GAP,
  findCrossings,
  WEAVE_TOLERANCE,
} from "./thread-crossings.ts";
import { authoredMeasuredSections } from "./thread-fallback.ts";
import type { MotifId } from "./thread-geometry.ts";
import { splitSubpaths, threadLine } from "./thread-line.ts";
import { MOTIFS } from "./thread-motifs.ts";
import { samplePath } from "./thread-samples.ts";

/* Every crossing inside a motif, at every band, as fractions of that motif piece's length. A motif's
   weave is stored once, so it has to name every crossing its drawing has at any size. */
function motifCrossings() {
  const found: {
    band: string;
    kind: MotifId;
    first: number;
    second: number;
  }[] = [];
  for (const band of THREAD_BANDS) {
    const line = threadLine(band.id, authoredMeasuredSections(band.id));
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

test("every weave entry is a crossing the motif has at some band", () => {
  const found = motifCrossings();
  for (const [kind, motif] of Object.entries(MOTIFS)) {
    for (const entry of motif.weave) {
      assert.ok(
        found.some(
          (crossing) => crossing.kind === kind && near(entry, crossing),
        ),
        `${kind}: weave entry ${entry.first} / ${entry.second} matches no crossing`,
      );
      assert.ok(entry.first < entry.second);
      assert.ok(entry.over === "first" || entry.over === "second");
    }
  }
});
