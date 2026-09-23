import assert from "node:assert/strict";
import { test } from "node:test";
import { composePath } from "./thread-geometry.ts";
import { MOTIFS } from "./thread-motifs.ts";
import { ALL_THREADS, SECTION_THREADS } from "./thread-placement.ts";

test("every section's exit x equals the next section's entry x", () => {
  for (let i = 0; i < SECTION_THREADS.length - 1; i += 1) {
    const here = SECTION_THREADS[i];
    const next = SECTION_THREADS[i + 1];
    assert.equal(
      here.exitX,
      next.entryX,
      `${here.id} exits at ${here.exitX} but ${next.id} enters at ${next.entryX}`,
    );
  }
});

test("the page thread runs invite to wishes in order, six links", () => {
  assert.deepEqual(
    SECTION_THREADS.map((s) => s.id),
    ["invite", "event-info", "contact", "family", "celebrations", "wishes"],
  );
});

test("only invite has no entry terminal and only wishes has no exit", () => {
  const noEntry = SECTION_THREADS.filter((s) => s.entryX === null).map(
    (s) => s.id,
  );
  const noExit = SECTION_THREADS.filter((s) => s.exitX === null).map(
    (s) => s.id,
  );
  assert.deepEqual(noEntry, ["invite"]);
  assert.deepEqual(noExit, ["wishes"]);
});

test("composePath joins every segment at a matching tangent", () => {
  for (const section of SECTION_THREADS) {
    const d = composePath(section, MOTIFS);
    assert.match(d, /^M /, `${section.id} must start with a moveto`);
    assert.equal(d.includes("NaN"), false, `${section.id} emitted NaN`);
  }
});

/* A non-uniform stretch (the only way a connector reaches its terminal without distorting a
   uniformly-scaled motif) preserves only the horizontal and vertical directions — so a connector
   can meet a motif on no other angle. Every declared tangent must therefore be 0 or 90. */
test("every motif's declared tangent is horizontal or vertical", () => {
  for (const motif of Object.values(MOTIFS)) {
    for (const tangent of [motif.entry, motif.exit]) {
      assert.ok(
        tangent.angle === 0 || tangent.angle === 90,
        `${motif.id} declares a tangent at ${tangent.angle} degrees, neither 0 nor 90`,
      );
    }
  }
});

test("ALL_THREADS appends the closed not-found thread to SECTION_THREADS, not a copy of it", () => {
  assert.deepEqual(
    ALL_THREADS.slice(0, SECTION_THREADS.length),
    SECTION_THREADS,
  );
  assert.equal(ALL_THREADS.length, SECTION_THREADS.length + 1);
  assert.equal(ALL_THREADS.at(-1)?.id, "not-found");
});
