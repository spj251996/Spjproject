import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const SECTION_NAMES = [
  "InviteSection",
  "EventInfoSection",
  "ContactSection",
  "FamilySection",
  "CelebrationsSection",
  "WishesSection",
];

const ROUTES = ["app/page.tsx", "app/thread/[variant]/page.tsx"];

/* `app/_sections/index.tsx` is the ONE list of sections. A route that names a section instead of
   composing `Sections` is how the published page and the lab drift the first time a seventh section
   lands -- the failure this whole structure exists to prevent. */
test("no route enumerates sections -- every route composes Sections", () => {
  for (const route of ROUTES) {
    const source = readFileSync(route, "utf8");
    assert.match(source, /\bSections\b/, `${route} does not compose Sections`);
    for (const name of SECTION_NAMES) {
      assert.ok(
        !source.includes(name),
        `${route} names ${name} directly -- compose Sections instead, or the two pages drift`,
      );
    }
  }
});

/* The published page carries no thread. Asserted on the import and the flag, because those are what a
   later edit reaches for; the BUILT page is asserted separately by scripts/check-export-routes.mjs,
   since a green build proves nothing about the artifact. */
test("the published route neither imports the thread nor sets the flag", () => {
  const raw = readFileSync("app/page.tsx", "utf8");
  /* Comments are stripped first so the file may EXPLAIN that it carries no thread. Asserting over raw
     source would forbid the word in the one place a reader needs it, which is how a guard ends up
     fought rather than followed. The slice is bounded by the comment syntax itself, not by a
     lookalike character. */
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  assert.ok(
    !code.includes("components/thread"),
    "app/page.tsx imports from components/thread -- the published page carries no thread",
  );
  assert.ok(
    !/\bthread\b/.test(code),
    "app/page.tsx passes a thread flag -- the published page carries none",
  );
});

test("the lab route sets the thread", () => {
  const source = readFileSync("app/thread/[variant]/page.tsx", "utf8");
  assert.match(
    source,
    /<Sections\s+thread/,
    "the lab route does not set the thread on Sections",
  );
});
