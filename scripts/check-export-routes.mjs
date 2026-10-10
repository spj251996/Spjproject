/* The built-export gate: which routes the export contains, and which carry thread roots. A green
 * build proves nothing about the artifact -- a route can be excluded by `pageExtensions`, and a
 * bundler can drop a file without erroring. Reads `out/` directly, never a served URL: `serve -s`
 * rewrites unknown paths to `index.html`, which has twice made a check measure the home page.
 *
 * It also discharges the `[lab]`-matches-reality claim for the thread: asserting `/` carries zero thread
 * roots IS the assertion that its subject is absent from the published page. It does NOT state how many
 * `[lab]` entries the doc has -- that count lives in the doc, and restating it here was a second copy
 * that went stale immediately.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/* Measured on the export before this gate was written: the trunk's no-JS fallback, the trunk's live
 * root, and the card thread's. Not a remembered figure. */
const LAB_ROOTS = 3;

/* `sections: true` marks a route that composes `app/_sections/index.tsx`. The not-found rows below do
 * NOT: that screen is its own route with its own frame, botanical, eyebrow, heading and action, and it
 * composes none of the six sections. The flag lives on the row rather than in a parallel list so that
 * adding a route sets it in the same object literal -- and it is a flag rather than a filter on the
 * path, because a filter would silently re-include the next not-found-shaped route. */
const EXPECTED = [
  {
    path: "out/index.html",
    roots: 0,
    label: "/ (published)",
    sections: true,
    stockPaint: false,
    /* Contact is off the published page but still on every lab route, because `contact` is in
     * `THREAD_IDS` and the thread refuses to measure a page whose section count disagrees with it.
     * The check after the loop below asserts an omitted id is still present SOMEWHERE -- an id
     * omitted everywhere is the dropped-section failure this half of the gate exists to catch, and
     * without it adding a name here would be a way to hide one. */
    omits: ["contact"],
  },
  {
    sections: true,
    /* MEASURED, not assumed: under `output: "export"` this version emits a dynamic route as
     * `out/thread/<variant>.html`, NOT `out/thread/<variant>/index.html`. The sibling
     * `out/thread/<variant>/` directory it also writes holds only RSC payload `.txt` files. */
    path: "out/thread/current.html",
    roots: LAB_ROOTS,
    label: "/thread/current (lab)",
    stockPaint: false,
  },
  {
    sections: true,
    path: "out/thread/mount.html",
    roots: LAB_ROOTS,
    label: "/thread/mount (lab)",
    stockPaint: false,
  },
  {
    sections: true,
    path: "out/thread/stock.html",
    roots: LAB_ROOTS,
    label: "/thread/stock (lab)",
    stockPaint: true,
  },
  {
    sections: true,
    /* MEASURED on the export, not assumed: a non-dynamic static route emits `out/preview.html`
     * with a sibling `out/preview/` directory holding only RSC payload `.txt` files -- the same
     * shape the dynamic thread routes take. A gate that listed `out/preview` would find the
     * directory and prove nothing.
     *
     * `[retire]`: THIS ROW GOES WITH THE ROUTE, and it has to be REPLACED by a `FORBIDDEN` entry
     * rather than merely deleted. Nothing here enumerates `out/`'s root, so a stray
     * `out/preview.html` left behind by a half-done removal would fail nothing at all. */
    path: "out/preview.html",
    roots: 0,
    label: "/preview (the couple's review)",
    stockPaint: false,
    /* It renders `app/page.tsx`, which passes `contact={false}`, so it omits exactly what `/`
     * omits. */
    omits: ["contact"],
  },
  /* The not-found screen, which is the ONLY coverage it has: no test and no render sweep opens it, and
   * that absence is why it shipped 99.7% red for a month. Its thread was retired deliberately, so there
   * is nothing thread-shaped left to assert -- what is left is that the route exists and carries none.
   *
   * BOTH files are checked because the export emits both and both ship: `404.html` is what a static host
   * serves for an unknown path, `_not-found.html` is the route-named emission. They are byte-identical
   * today, so asserting one would leave the other unguarded for free.
   *
   * Asserted against the built file, never a served URL: an SPA-fallback rewrite returns the index
   * document for any unknown path, which has already made a check of `/404` measure the HOME page. */
  { path: "out/404.html", roots: 0, label: "/404 (not found, served)" },
  { path: "out/_not-found.html", roots: 0, label: "/_not-found (route-named)" },
];
const FORBIDDEN = ["out/design-system/index.html", "out/lab-scratch"];
/* The exact SET of lab routes, so an extra one cannot appear unnoticed. Asserting the set rather than
 * listing forbidden paths means Plan 2 updates one line instead of remembering to delete a guard. */
const LAB_ROUTES = ["current", "mount", "stock"];

/* THE OTHER HALF OF THE DOC PARITY GATE. Its first half -- every `[lab]` entry's subject absent from
 * the published page -- is the thread assertion above. Its second half, "every non-`[lab]` one is
 * present", was asserted NOWHERE: this gate counted thread roots and route names and nothing else, so a
 * section dropped from the export would have passed it. A missing section is exactly what a bundler can
 * lose without erroring, which is why a green build is not evidence.
 *
 * The component list is read from the one module that composes them, so adding a section reaches this
 * gate without anyone remembering to. The COUNT is asserted because a zero-match extraction looks
 * exactly like a successful one. */
const SECTION_COMPONENTS = [
  ...readFileSync("app/_sections/index.tsx", "utf8").matchAll(
    /<(\w+Section)\b/g,
  ),
].map((m) => m[1]);

/* Six. This list was five under a comment saying `invite` carried no `id`; `29b2c52` gave it one, and
 * that comment's own instruction was that a sixth id appearing is the prompt to add it here. Adding it
 * widens this gate to a section it had never checked. */
const SECTION_IDS = [
  "invite",
  "event-info",
  "contact",
  "family",
  "celebrations",
  "wishes",
];

let failed = false;

if (SECTION_COMPONENTS.length !== 6) {
  console.error(
    `FAIL: expected six sections in app/_sections/index.tsx, found ${SECTION_COMPONENTS.length} [${SECTION_COMPONENTS}] -- re-anchor this gate`,
  );
  failed = true;
}
if (!EXPECTED.some((route) => route.sections)) {
  console.error(
    "FAIL: no route is marked `sections: true`, so the section-presence check would pass vacuously",
  );
  failed = true;
}

/* THE `stock` PAINT REACHES THE BUILT CSS, AND ONLY THE ROUTE THAT ASKS FOR IT. Both halves need the
 * built artifact and neither is visible in the source: a `var()` that resolves to nothing builds green,
 * and the frame's stylesheet is inlined PER SECTION, so what each page ships is decided by the argument
 * its call sites pass rather than by anything a grep of the component would show.
 *
 * `--shadow-mounted-stock` is a comma list of two `var()`s, which Tailwind inlines into the utility's
 * own `--tw-shadow`. The inner names are asserted, not just the token's presence: a token that resolved
 * to nothing would still appear here. */
const CSS_DIR = "out/_next/static/chunks";
const STOCK_CLASS = "shadow-mounted-stock";
if (existsSync(CSS_DIR)) {
  const css = readdirSync(CSS_DIR)
    .filter((name) => name.endsWith(".css"))
    .map((name) => readFileSync(join(CSS_DIR, name), "utf8"))
    .join("\n");
  const rule = css.match(/\.shadow-mounted-stock\{[^}]*\}/)?.[0] ?? "";
  const composed =
    rule.includes("var(--shadow-mount)") &&
    rule.includes("var(--shadow-stock)");
  console.log(
    `${composed ? "ok  " : "FAIL"} built CSS: .${STOCK_CLASS} composes both shadow recipes`,
  );
  if (!composed) {
    console.error(`     rule found: ${rule || "(none)"}`);
    failed = true;
  }
} else {
  console.error(`FAIL: ${CSS_DIR} is missing -- no built CSS to check`);
  failed = true;
}

for (const { path, roots, label, sections, stockPaint, omits } of EXPECTED) {
  if (!existsSync(path)) {
    console.error(`FAIL ${label}: ${path} is missing from the export`);
    failed = true;
    continue;
  }
  const html = readFileSync(path, "utf8");
  const found = (html.match(/data-thread-svg/g) ?? []).length;
  const ok = found === roots;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${label}: ${found} thread roots, expected ${roots}`,
  );
  if (!ok) failed = true;

  if (stockPaint !== undefined) {
    const uses = (html.match(new RegExp(STOCK_CLASS, "g")) ?? []).length;
    const ok = stockPaint ? uses > 0 : uses === 0;
    console.log(
      `${ok ? "ok  " : "FAIL"} ${label}: ${uses} ${STOCK_CLASS} uses, expected ${stockPaint ? "some" : "none"}`,
    );
    if (!ok) failed = true;
  }

  if (!sections) continue;
  const expectedIds = SECTION_IDS.filter((id) => !(omits ?? []).includes(id));
  const missing = expectedIds.filter((id) => !html.includes(`id="${id}"`));
  const present = expectedIds.length - missing.length;
  const allThere = missing.length === 0;
  console.log(
    `${allThere ? "ok  " : "FAIL"} ${label}: ${present}/${expectedIds.length} documented sections present${allThere ? "" : ` -- missing ${missing}`}`,
  );
  if (!allThere) failed = true;

  /* An omitted id must be ABSENT, not merely unchecked. Without this, a section that stopped
   * rendering on the route that omits it would read the same as one deliberately left off. */
  const strays = (omits ?? []).filter((id) => html.includes(`id="${id}"`));
  if (strays.length > 0) {
    console.error(
      `FAIL ${label}: [${strays}] marked omitted but present in the export`,
    );
    failed = true;
  }
}

/* AN ID OMITTED FROM EVERY ROUTE IS A DROPPED SECTION, NOT AN OMISSION. Without this, adding a name
 * to one route's `omits` and losing it from the build entirely would read as a pass -- which is the
 * exact failure the section-presence half of this gate was added to catch. */
const sectionRoutes = EXPECTED.filter((route) => route.sections);
const omittedEverywhere = SECTION_IDS.filter((id) =>
  sectionRoutes.every((route) => (route.omits ?? []).includes(id)),
);
console.log(
  `${omittedEverywhere.length === 0 ? "ok  " : "FAIL"} every documented section is present on at least one route${omittedEverywhere.length === 0 ? "" : ` -- [${omittedEverywhere}] omitted everywhere`}`,
);
if (omittedEverywhere.length > 0) failed = true;
for (const path of FORBIDDEN) {
  if (existsSync(path)) {
    console.error(`FAIL: ${path} must not be in the export`);
    failed = true;
  }
}

/* `/preview`'s TWO OWN CLAIMS, and both need the built artifact.
 *
 * ONE: NO ROUTE SERVER-RENDERS A LEVER. The panel sets its attributes in a client effect, so the
 * shipped state is the absence of every one of them -- which is what makes the couple's first
 * paint the recommended state with nothing to jump, and what makes `/preview` at rest the
 * published page. Asserted across EVERY route rather than just `/preview`: an attribute appearing
 * on `/` would mean an alternate had leaked into the published page, which is the worse failure
 * and the one no source test can see.
 *
 * TWO: THE ALTERNATES' CSS REACHES `/preview` ALONE. Measured, not hoped for -- route-scoped CSS
 * imported from a route file gets its own chunk, so `/` carries zero bytes of it rather than the
 * "zero uses in a shared chunk" the plan had budgeted for. If a later change folds it into a
 * shared chunk this fails, and the claim to fall back to is zero USES, not zero bytes. */
const PV_PREFIX = "data-pv-";
const PV_ROUTES = EXPECTED.filter((route) => route.sections);
for (const { path, label } of PV_ROUTES) {
  if (!existsSync(path)) continue;
  const uses = (readFileSync(path, "utf8").match(/data-pv-/g) ?? []).length;
  const ok = uses === 0;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${label}: ${uses} ${PV_PREFIX} attributes server-rendered, expected none`,
  );
  if (!ok) failed = true;
}

if (existsSync(CSS_DIR)) {
  const variantSheets = readdirSync(CSS_DIR)
    .filter((name) => name.endsWith(".css"))
    .filter((name) =>
      readFileSync(join(CSS_DIR, name), "utf8").includes(PV_PREFIX),
    );
  const preview = existsSync("out/preview.html")
    ? readFileSync("out/preview.html", "utf8")
    : "";
  const published = existsSync("out/index.html")
    ? readFileSync("out/index.html", "utf8")
    : "";
  const onPreview = variantSheets.filter((name) => preview.includes(name));
  const onPublished = variantSheets.filter((name) => published.includes(name));
  const ok =
    variantSheets.length > 0 &&
    onPreview.length === variantSheets.length &&
    onPublished.length === 0;
  console.log(
    `${ok ? "ok  " : "FAIL"} the alternates' CSS is on /preview alone: ${variantSheets.length} sheet(s), ${onPreview.length} on /preview, ${onPublished.length} on /`,
  );
  if (!ok) failed = true;
}
/* `/thread/mount` DIFFERS FROM `/thread/current` IN ONE THING ONLY: it overrides the hero's `"none"`,
 * so it paints one more mount than `/` does. Nothing gated that — set its variant's paint to `undefined`
 * and the route becomes byte-equivalent to `current` with the suite, `tsc` and every row above still
 * green, because `stockPaint: false` is satisfied by an unpainted hero just as well as by a painted one.
 * The owner's whole reason for that route is a uniform comparison, so a silently-unpainted hero would
 * invalidate the look it exists for.
 *
 * Asserted as a STRICT INEQUALITY against `current` rather than as a count, because the absolute number
 * moves whenever a card's paint utilities change and a pinned figure would then fail correct work. */
const MOUNT_FILL = "bg-surface-mount";
const paintedMounts = (path) =>
  existsSync(path)
    ? (readFileSync(path, "utf8").match(new RegExp(MOUNT_FILL, "g")) ?? [])
        .length
    : null;
const currentMounts = paintedMounts("out/thread/current.html");
const mountMounts = paintedMounts("out/thread/mount.html");
if (currentMounts === null || mountMounts === null) {
  console.error(
    "FAIL: cannot compare the lab's paint routes -- one of them is missing",
  );
  failed = true;
} else {
  const ok = mountMounts > currentMounts;
  console.log(
    `${ok ? "ok  " : "FAIL"} /thread/mount paints more mounts than /thread/current: ${mountMounts} against ${currentMounts}`,
  );
  if (!ok) failed = true;
}

if (existsSync("out/thread")) {
  /* The variant names are read off the emitted HTML documents alone -- the same directory also holds
   * each route's RSC payload directory and `.txt` files, which are not routes. */
  const actual = readdirSync("out/thread")
    .filter((name) => name.endsWith(".html"))
    .map((name) => name.replace(/\.html$/, ""))
    .sort();
  const expected = [...LAB_ROUTES].sort();
  const ok =
    actual.length === expected.length &&
    actual.every((name, i) => name === expected[i]);
  console.log(
    `${ok ? "ok  " : "FAIL"} lab routes: [${actual}], expected [${expected}]`,
  );
  if (!ok) failed = true;
} else {
  console.error(
    "FAIL: out/thread is missing -- the lab route was not exported",
  );
  failed = true;
}
console.log(failed ? "VERDICT: FAIL" : "VERDICT: PASS");
process.exit(failed ? 1 : 0);
