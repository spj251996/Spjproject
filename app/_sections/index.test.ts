import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const SECTION_NAMES = [
  "InviteSection",
  "EventInfoSection",
  "FamilySection",
  "CelebrationsSection",
  "WishesSection",
];

const ROUTES = ["app/page.tsx", "app/thread/page.tsx"];

/* `app/_sections/index.tsx` is the ONE list of sections. A route that names a section instead of
   composing `Sections` is how the published page and the lab drift the first time a sixth section
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
  const source = readFileSync("app/thread/page.tsx", "utf8");
  /* The CLAIM, that `thread` is among the props the lab route hands `Sections`, rather than a
     spelling, which would fail a correct reordering of props. The element's prop list is bounded by
     its own `>`. */
  const at = source.indexOf("<Sections");
  assert.ok(at !== -1, "the lab route does not compose Sections at all");
  const props = source.slice(at + "<Sections".length, source.indexOf(">", at));
  assert.match(
    props,
    /\bthread\b/,
    `the lab route does not set the thread on Sections: <Sections${props}>`,
  );
});

/* Two routes: `/` and `/thread`. The lab is ONE static route painted like `/`, so a variant
   directory coming back is the regression. */
test("the thread lab is one static route, painted as / is", () => {
  assert.ok(
    existsSync("app/thread/page.tsx"),
    "app/thread/page.tsx is missing",
  );
  assert.ok(!existsSync("app/thread/[variant]"), "the variant routes are back");
  /* Comments stripped: the page's own header comment talks ABOUT paint. */
  const lab = readFileSync("app/thread/page.tsx", "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
  assert.doesNotMatch(
    lab,
    /\bpaint=/,
    "/thread passes a paint, so it no longer shows what / ships",
  );
});

/* The thread's render gates carry their own section lists, so a section added to the module would be
   skipped by them with every gate green. The page's ids are read off the module in composition order:
   each `<…Section` the module renders, then that component's own `<section id>`. Read as text, because
   importing a gate launches its browser. */
test("the thread render gates sweep exactly the sections the module composes, in order", () => {
  const module = readFileSync("app/_sections/index.tsx", "utf8");
  const imports = new Map(
    [...module.matchAll(/import \{ (\w+Section) \} from "\.\/([\w-]+)";/g)].map(
      (m) => [m[1], m[2]],
    ),
  );
  const rendered = [...module.matchAll(/<(\w+Section)\b/g)].map((m) => m[1]);
  assert.ok(
    rendered.length > 0,
    "no section rendered by app/_sections/index.tsx",
  );
  const ids = rendered.map((name) => {
    const file = imports.get(name);
    assert.ok(file, `${name} is not imported from a sibling file`);
    const id = readFileSync(`app/_sections/${file}.tsx`, "utf8").match(
      /<section\b[^>]*\bid="([\w-]+)"/,
    )?.[1];
    assert.ok(id, `${file}.tsx has no <section id>`);
    return id;
  });
  const listIn = (path: string, name: string) => {
    const body = readFileSync(path, "utf8").match(
      new RegExp(`const ${name} = \\[([^\\]]*)\\]`),
    )?.[1];
    assert.ok(body, `${path} declares no ${name} list`);
    return [...body.matchAll(/"([\w-]+)"/g)].map((m) => m[1]);
  };
  assert.deepEqual(
    listIn("scripts/check-thread-clearance.mjs", "SECTION_IDS"),
    ids,
  );
  assert.deepEqual(listIn("scripts/check-thread-joins.mjs", "SECTIONS"), ids);
});

test("/preview is retired", () => {
  assert.ok(!existsSync("app/preview"), "app/preview is back");
});
