/* The built-export gate: which routes the export contains, and which carry thread roots. A green
 * build proves nothing about the artifact -- a route can be excluded by `pageExtensions`, and a
 * bundler can drop a file without erroring. Reads `out/` directly, never a served URL: `serve -s`
 * rewrites unknown paths to `index.html`, which has twice made a check measure the home page.
 *
 * It also discharges the `[lab]`-matches-reality claim for the thread: asserting `/` carries zero thread
 * roots IS the assertion that its subject is absent from the published page. It does NOT state how many
 * `[lab]` entries the doc has -- that count lives in the doc.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FRAME_SHEETS } from "../app/frame-sheets.ts";
import { splitAtRuleBlocks, topLevelRules } from "./css-top-level-rules.mjs";
import { linkedStylesheets } from "./linked-stylesheets.mjs";

/* Measured on the export before this gate was written: the trunk's no-JS fallback, the trunk's live
 * root, and the card thread's. Not a remembered figure. */
const LAB_ROOTS = 3;

const FIVE_FRAMES = ["invite", "event-info", "family", "wishes", "tall"];

/* `sections: true` marks a route that composes `app/_sections/index.tsx`. The not-found rows below do
 * NOT: that screen is its own route with its own frame, botanical, eyebrow, heading and action, and it
 * composes none of the five sections. The flag lives on the row rather than in a parallel list so that
 * adding a route sets it in the same object literal -- and it is a flag rather than a filter on the
 * path, because a filter would silently re-include the next not-found-shaped route. */
const EXPECTED = [
  {
    path: "out/index.html",
    roots: 0,
    label: "/ (published)",
    sections: true,
    progress: 1,
    frames: FIVE_FRAMES,
  },
  {
    sections: true,
    /* MEASURED on this export before writing: a static route emits
     * `out/thread.html` with a sibling `out/thread/` directory of RSC payload `.txt` files only. */
    path: "out/thread.html",
    roots: LAB_ROOTS,
    label: "/thread (lab)",
    progress: 0,
    frames: FIVE_FRAMES,
  },
  /* The not-found screen. Its thread was retired, so what is asserted is that the route exists and
   * carries none.
   *
   * BOTH files are checked because the export emits both and both ship: `404.html` is what a static host
   * serves for an unknown path, `_not-found.html` is the route-named emission. They are byte-identical
   * today, so asserting one would leave the other unguarded for free.
   *
   * Asserted against the built file, never a served URL: an SPA-fallback rewrite returns the index
   * document for any unknown path, which has already made a check of `/404` measure the HOME page. */
  {
    path: "out/404.html",
    roots: 0,
    label: "/404 (not found, served)",
    frames: ["not-found"],
  },
  {
    path: "out/_not-found.html",
    roots: 0,
    label: "/_not-found (route-named)",
    frames: ["not-found"],
  },
];
const FORBIDDEN = [
  "out/design-system/index.html",
  "out/lab-scratch",
  "out/thread/current.html",
  "out/thread/mount.html",
  "out/thread/stock.html",
  /* A stray copy left by a half-done removal would otherwise fail nothing: nothing here enumerates
     `out/`'s root. */
  "out/preview.html",
];

/* THE OTHER HALF OF THE DOC PARITY GATE: every non-`[lab]` section is present in the export. A missing
 * section is exactly what a bundler can lose without erroring, which is why a green build is not
 * evidence.
 *
 * The component list is read from the one module that composes them, so adding a section reaches this
 * gate without anyone remembering to. The COUNT is asserted because a zero-match extraction looks
 * exactly like a successful one. */
const SECTION_COMPONENTS = [
  ...readFileSync("app/_sections/index.tsx", "utf8").matchAll(
    /<(\w+Section)\b/g,
  ),
].map((m) => m[1]);

/* Five, one per section every route composes; the retired `contact` is asserted ABSENT below. */
const SECTION_IDS = [
  "invite",
  "event-info",
  "family",
  "celebrations",
  "wishes",
];
const RETIRED_SECTION_IDS = ["contact"];

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* Separates a stylesheet into the text outside every `@supports (justify-content: safe center)` block
 * and the blocks themselves, matching the minifier's spacing and parentheses tolerantly. */
const SUPPORTS_PRELUDE =
  /^@supports\s*\(?\s*\(?\s*justify-content\s*:\s*safe center\s*\)?\s*\)?$/;

const splitSupports = (css) => splitAtRuleBlocks(css, SUPPORTS_PRELUDE);

let failed = false;

if (SECTION_COMPONENTS.length !== 5) {
  console.error(
    `FAIL: expected five sections in app/_sections/index.tsx, found ${SECTION_COMPONENTS.length} [${SECTION_COMPONENTS}] -- re-anchor this gate`,
  );
  failed = true;
}
if (!EXPECTED.some((route) => route.sections)) {
  console.error(
    "FAIL: no route is marked `sections: true`, so the section-presence check would pass vacuously",
  );
  failed = true;
}

/* The stock paint is retired: no built stylesheet may still carry its composed shadow. A missing
 * chunk directory fails rather than passing on an empty listing. */
const CSS_DIR = "out/_next/static/chunks";
if (existsSync(CSS_DIR)) {
  const stockLeft = readdirSync(CSS_DIR).filter(
    (name) =>
      name.endsWith(".css") &&
      readFileSync(join(CSS_DIR, name), "utf8").includes(
        "shadow-mounted-stock",
      ),
  );
  console.log(
    `${stockLeft.length === 0 ? "ok  " : "FAIL"} built CSS: no retired stock shadow${stockLeft.length ? ` -- in [${stockLeft}]` : ""}`,
  );
  if (stockLeft.length > 0) failed = true;
} else {
  console.error(`FAIL: ${CSS_DIR} is missing -- no built CSS to check`);
  failed = true;
}

/* The frame sheets are imported files, so a route links them and its HTML carries none. The scope
 * class is what a sheet's rules are keyed on; `tall` is the one sheet whose scope is not its name. */
const frameScope = (name) =>
  name === "tall"
    ? "mounted-sheet-frame--tall-section-mount"
    : `mounted-sheet-frame--${name}`;

for (const { path, roots, label, sections, progress, frames } of EXPECTED) {
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

  if (progress !== undefined) {
    const bars = (html.match(/data-scroll-progress/g) ?? []).length;
    const ok = bars === progress;
    console.log(
      `${ok ? "ok  " : "FAIL"} ${label}: ${bars} scroll progress bar(s), expected ${progress}`,
    );
    if (!ok) failed = true;
  }

  /* `.mounted-sheet-frame__box` after a child combinator appears only inside frame CSS, never in a class
   * attribute, in its literal or its JSON-escaped (`\u003e`) form. */
  const inlineFrameCss = (
    html.match(/(>|\\u003e) ?\.mounted-sheet-frame__box/g) ?? []
  ).length;
  console.log(
    `${inlineFrameCss === 0 ? "ok  " : "FAIL"} ${label}: no inline or payload frame CSS${inlineFrameCss ? ` (${inlineFrameCss} occurrences)` : ""}`,
  );
  if (inlineFrameCss > 0) failed = true;

  /* Only the stylesheets this route links: concatenating every built chunk would read another route's
   * override first. */
  const sheets = linkedStylesheets(html, "out");
  for (const { href } of sheets.filter((sheet) => sheet.css === null)) {
    console.error(`FAIL ${label}: linked stylesheet ${href} missing from out/`);
    failed = true;
  }
  const linkedCss = sheets.map((sheet) => sheet.css ?? "").join("\n");
  if (sheets.length === 0 || linkedCss === "") {
    console.error(`FAIL ${label}: links no readable stylesheet`);
    failed = true;
  } else {
    /* The scope alone is not frame-only (`app/invite.css` names the invite's), but a child combinator
     * onto the frame's box is, in any spacing the minifier leaves. */
    const missingScopes = frames.filter(
      (name) =>
        !new RegExp(
          `\\.${escapeRegExp(frameScope(name))}\\s*>\\s*\\.mounted-sheet-frame__box`,
        ).test(linkedCss),
    );
    console.log(
      `${missingScopes.length === 0 ? "ok  " : "FAIL"} ${label}: linked CSS (${sheets.length} sheets) carries ${frames.length - missingScopes.length}/${frames.length} frame scopes${missingScopes.length ? ` -- missing ${missingScopes}` : ""}`,
    );
    if (missingScopes.length > 0) failed = true;

    /* The minifier merges `center; safe center` in one rule into `safe center` alone, which strips the
     * fallback an engine without `safe` needs. The form that ships is a plain `center` rule per scope
     * plus `safe center` inside `@supports` only. */
    const { outside, blocks } = splitSupports(linkedCss);
    const safeSelectors = blocks.flatMap((block) =>
      topLevelRules(block.slice(block.indexOf("{") + 1, -1)).flatMap(
        ({ selectors }) => selectors,
      ),
    );
    const lackSafe = frames.filter(
      (name) => !safeSelectors.includes(`.${frameScope(name)}`),
    );
    console.log(
      `${lackSafe.length === 0 ? "ok  " : "FAIL"} ${label}: ${frames.length - lackSafe.length}/${frames.length} frame scopes sit in a \`@supports (justify-content: safe center)\` block${lackSafe.length ? ` -- missing ${lackSafe}` : ""}`,
    );
    if (lackSafe.length > 0) failed = true;

    /* Each frame's own scope rule and its sheet rule centre in plain form. Only an unconditional,
     * top-level rule whose selector list holds the exact selector counts: a descendant form
     * (`.scope .piece`) or a rule inside an at-rule is not the frame's own. The sheet's selector is
     * the one `sheetSelector` emits for the frame's layout, so a pair's leaf form on a single frame
     * (or the reverse) fails. */
    const baseRules = topLevelRules(outside);
    const centresPlain = (selector) =>
      baseRules.some(
        ({ selectors, body }) =>
          selectors.includes(selector) &&
          /justify-content:\s*center\b/.test(body) &&
          /align-items:\s*center\b/.test(body),
      );
    const lackPlain = frames.flatMap((name) => {
      const entry = FRAME_SHEETS.find((sheet) => sheet.name === name);
      if (entry === undefined) {
        console.error(`FAIL: frame "${name}" has no entry in FRAME_SHEETS`);
        failed = true;
        return [`${name} (no FRAME_SHEETS entry)`];
      }
      const scope = `.${frameScope(name)}`;
      const mount = `${scope}>.mounted-sheet-frame__box>.mounted-sheet-frame__mount`;
      const sheet =
        entry.layout === "pair"
          ? `${mount}>.mounted-sheet-frame__leaf>.mounted-sheet-frame__sheet`
          : `${mount}>.mounted-sheet-frame__sheet`;
      const missing = [];
      if (!centresPlain(scope)) missing.push(`${name} scope`);
      if (!centresPlain(sheet)) missing.push(`${name} sheet`);
      return missing;
    });
    console.log(
      `${lackPlain.length === 0 ? "ok  " : "FAIL"} ${label}: every frame scope and sheet carries a plain center base rule${lackPlain.length ? ` -- missing ${lackPlain}` : ""}`,
    );
    if (lackPlain.length > 0) failed = true;

    const strayCount = (
      outside.match(/(justify-content|align-items):\s*safe center/g) ?? []
    ).length;
    console.log(
      `${strayCount === 0 ? "ok  " : "FAIL"} ${label}: no \`safe center\` outside @supports${strayCount ? ` (${strayCount} occurrences)` : ""}`,
    );
    if (strayCount > 0) failed = true;
  }

  if (!sections) continue;
  const expectedIds = SECTION_IDS;
  const missing = expectedIds.filter((id) => !html.includes(`id="${id}"`));
  const present = expectedIds.length - missing.length;
  const allThere = missing.length === 0;
  console.log(
    `${allThere ? "ok  " : "FAIL"} ${label}: ${present}/${expectedIds.length} documented sections present${allThere ? "" : ` -- missing ${missing}`}`,
  );
  if (!allThere) failed = true;

  /* A retired section must be ABSENT, not merely unchecked — a stray render of one would otherwise
   * read the same as its removal. */
  const strays = RETIRED_SECTION_IDS.filter((id) =>
    html.includes(`id="${id}"`),
  );
  if (strays.length > 0) {
    console.error(`FAIL ${label}: retired [${strays}] is still in the export`);
    failed = true;
  }
}
for (const path of FORBIDDEN) {
  if (existsSync(path)) {
    console.error(`FAIL: ${path} must not be in the export`);
    failed = true;
  }
}

/* The lab is ONE route. Its sibling directory holds RSC payloads only, so any `.html` in it is a retired variant
 * route left behind -- which `next build` should never leave, since it rewrites `out/` whole. */
const strayLab = existsSync("out/thread")
  ? readdirSync("out/thread").filter((name) => name.endsWith(".html"))
  : [];
console.log(
  `${strayLab.length === 0 ? "ok  " : "FAIL"} no variant lab route in out/thread${strayLab.length ? ` -- found [${strayLab}]` : ""}`,
);
if (strayLab.length > 0) failed = true;
console.log(failed ? "VERDICT: FAIL" : "VERDICT: PASS");
process.exit(failed ? 1 : 0);
