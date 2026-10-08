#!/usr/bin/env node
/* The type-clearance gate (Phase 6b): the thread may cross the ring, the mount, any
   stock, any botanical piece — but never type. This re-runnable script proves that at six
   aspect-band windows per section.

   SELECTOR CONVENTION: every SVG element that draws part of the thread carries `data-thread-svg`
   on its OWN <svg> root. Icons already carry `aria-hidden` (see `components/icons/icon-base.tsx`),
   so `aria-hidden` alone cannot distinguish thread SVGs from decorative ones.

   THE THREAD IS PAGE-LEVEL, NOT PER-SECTION (since Task 6's cutover): `<PageThread>` bakes the
   whole page into ONE path and mounts its SVG as the LAST CHILD of `<main>` — a SIBLING of every
   `<section>`, not a descendant of any one of them (`components/thread/page-thread.tsx`'s own
   header comment states this is deliberate: a section-scoped SVG could only paint in front of
   Wishes' illustration, never behind it). So `section#<id> svg[data-thread-svg] path` — this gate's
   original selector — matches nothing for five of six sections; only Wishes ever had a descendant
   match, because `CardThread` mounts inside `#wishes` itself (in the card, so the stretch paints behind
   the type, for that same z-index reason). The fix: search the WHOLE DOCUMENT for
   `data-thread-svg` paths, then CLIP each one's geometry to the section's own rect before
   measuring — never re-introduce a per-section SVG to make the old selector work again, which is
   exactly the mis-sizing this plan's thread rewrite removed (`session.md`, 2026-09-27).

   METHOD, per section per aspect-band window:
     1. Find every `data-thread-svg` path ANYWHERE in the document that carries a `d`.
     2. For each path, run a coarse 400-probe pass over its full length to find which
        arc-length RANGES land inside this section's own `getBoundingClientRect()` in screen space
        — a page-length path spends most of its length in other sections, so sampling the full
        length against one section's text would starve that section of resolution.
     3. Apportion a 200-point FINE sample budget across those in-section ranges by arc length
        (largest-remainder method), so a long connector segment gets more samples than a short
        motif segment rather than each getting an equal share regardless of size.
     4. Map every sampled point from the path's own user space into viewport (screen) coordinates
        via `getPointAtLength(...).matrixTransform(path.getScreenCTM())` — several of the real
        thread's own SVGs are non-uniformly scaled (`preserveAspectRatio="none"` connectors and the
        whole-page trunk), so an unmapped point would simply be wrong.
     5. Collect every GLYPH rect in the section — `Range.getClientRects()` over each visible
        text node, never an element's bounding box: a wrapper span is as wide as its column plus
        any overrun allowance, so bounding boxes report collisions that are not there.
     6. Report the minimum point-to-rect distance across every sampled point and every glyph
        rect. A distance of 0 (a sampled point on or inside a glyph rect) is a crossing —
        the one thing the placement rule forbids outright; being close is wanted, not flagged.

   ENGINE PIN (mandatory): `chromium.launch({ channel: "chromium" })`. The default launch reaches
   for Chromium's old `headless_shell`, which quantises glyph advances and renders text ~3%
   wider — every overflow figure taken without this pin on this project has been an artifact of
   the launch, not the page. Any measurement here without the pin is void.

   CAPS (no unbounded waits, no loops that iterate until they look right):
     - 6 sections x 3 aspect bands x 2 windows each = 36 checks per full sweep — a fixed, finite
       loop, not a convergence loop.
     - Navigation: 15s. Font-ready: 5s (best-effort; a timeout here is logged and the check
       proceeds against whatever fonts loaded, since Latin body copy renders close enough
       either way and this gate is about geometry, not glyph shaping).
     - Post-resize settle: one fixed 200ms wait, not a poll.

   DEV SERVER: this script never starts, stops, or restarts it — the dev server on :3000 is the
   owner's (Next 16 builds and dev-serves concurrently; a build still contends for machine
   resources). If nothing answers on :3000, the script exits with a clear message rather than
   spawning its own.

   USAGE:
     node scripts/check-thread-clearance.mjs                 # full sweep, all six sections
     node scripts/check-thread-clearance.mjs --section=family
     node scripts/check-thread-clearance.mjs --validate      # Step 2: harness self-check
     node scripts/check-thread-clearance.mjs --falsify       # Step 3: harness self-check
     node scripts/check-thread-clearance.mjs --falsify --section=wishes --band=upright --orientation=drifted
*/

import { chromium } from "playwright";
import { THREAD_BANDS } from "../components/thread/thread-bands.ts";

const ORIGIN = "http://localhost:3000";
/* The thread is not on the published page -- `/` carries none since the lab split, so this gate points
 * at the lab route (DESIGN.md -> Technical Conventions -> Variant Routes). Against the DEV server the
 * extensionless path routes correctly; a gate reading the static export needs `.html`, because an
 * export emits a dynamic route as `out/thread/<variant>.html`. */
const LAB_ROUTE = "/thread/current";

const NAV_TIMEOUT_MS = 15_000;
const FONT_TIMEOUT_MS = 5_000;
const SETTLE_MS = 200;
const SAMPLE_BUDGET = 200;

const THREAD_SELECTOR = "svg[data-thread-svg] path";

/* Every section carries its own `id`, invite included since 2026-10-08. It did not until then, and
   this function held a `main > section:first-of-type` exception for it with a comment claiming
   nothing else needed to address it — which `check-thread-joins.mjs` had been quietly disproving,
   reporting invite MISSING at all 12 of its windows because `#invite` matched nothing. */
function sectionSelectorFor(sectionId) {
  return `#${sectionId}`;
}

const SECTION_IDS = [
  "invite",
  "event-info",
  "contact",
  "family",
  "celebrations",
  "wishes",
];

/* One window per ASPECT BAND, not per width tier: thread geometry is emitted per band now, so a
   sweep keyed to widths could miss a band entirely. Each band contributes its own NOMINAL box —
   where the emitted geometry renders 1:1 — and one real window that DRIFTS from it inside the same
   band, which is where a placement defect shows. */
const DRIFTED = {
  tall: { width: 360, height: 780 },
  upright: { width: 834, height: 1112 },
  wide: { width: 1920, height: 900 },
};

const BANDS = THREAD_BANDS.map((band) => ({
  key: band.id,
  windows: [
    { key: "nominal", width: band.box.width, height: band.box.height },
    { key: "drifted", ...DRIFTED[band.id] },
  ],
}));

function parseArgs(argv) {
  const flags = { validate: false, falsify: false };
  for (const arg of argv) {
    if (arg === "--validate") {
      flags.validate = true;
      continue;
    }
    if (arg === "--falsify") {
      flags.falsify = true;
      continue;
    }
    const match = arg.match(/^--([a-z]+)=(.*)$/s);
    if (match) {
      flags[match[1]] = match[2];
    }
  }
  return flags;
}

async function isDevServerUp() {
  try {
    const response = await fetch(ORIGIN, { signal: AbortSignal.timeout(2000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForFonts(page) {
  try {
    await page.waitForFunction(() => document.fonts.status === "loaded", {
      timeout: FONT_TIMEOUT_MS,
    });
  } catch {
    console.error(
      "  warning: fonts did not report loaded within the timeout — proceeding anyway",
    );
  }
}

/* `PageThread` (`page-thread.tsx`) measures the real layout in a `useEffect`, which fires AFTER
   paint — before it runs, every `data-thread-svg` element still carries its CSS-only default
   position (`.pageRoot { position: absolute; inset: 0; }` relative to a ZERO-HEIGHT wrapper span
   sitting in normal flow after the last section), which collapses the whole thread to a small box
   wherever that wrapper happens to land, not a rect covering `<main>`. A fixed settle after
   navigation is not long enough for this on a Next dev server (measured: still unset at 300ms,
   always set by 500ms) and a fixed wait either races it or over-pads every run — so this waits for
   the one DOM fact `coverRect` actually writes: an inline `left` on some thread SVG, set only once
   real measurement has happened at least once. Never done as a fixed sleep, per this project's own
   `browser-testing.md` — wait for the state being verified, not a duration. */
async function waitForThreadMeasured(page) {
  try {
    await page.waitForFunction(
      () =>
        Array.from(document.querySelectorAll("svg[data-thread-svg]")).some(
          (svg) => svg.style.left !== "",
        ),
      { timeout: FONT_TIMEOUT_MS },
    );
  } catch {
    console.error(
      "  warning: the thread never reported itself measured within the timeout — proceeding anyway",
    );
  }
}

/* Runs inside the page. Never reference outer-scope variables here — everything it needs is
   passed as an argument, since `page.evaluate` serializes the function and its args separately. */
function measureSectionInPage({
  sectionSelector,
  threadSelector,
  sampleBudget,
}) {
  const section = document.querySelector(sectionSelector);
  if (!section) {
    return {
      error: `no element matching "${sectionSelector}" found in the DOM`,
    };
  }
  const sectionRect = section.getBoundingClientRect();

  const glyphRects = [];
  const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || node.nodeValue.trim() === "") {
        return NodeFilter.FILTER_REJECT;
      }
      const parent = node.parentElement;
      if (!parent) {
        return NodeFilter.FILTER_REJECT;
      }
      const style = getComputedStyle(parent);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        Number(style.opacity) === 0
      ) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let node = walker.nextNode();
  while (node) {
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const rect of range.getClientRects()) {
      if (rect.width > 0 && rect.height > 0) {
        glyphRects.push({
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          text: node.nodeValue.trim().slice(0, 60),
        });
      }
    }
    node = walker.nextNode();
  }

  /* The thread's SVG is a SIBLING of every section (mounted once, at the end of `<main>`), so the
     search is document-wide. */
  const candidatePaths = Array.from(
    document.querySelectorAll(threadSelector),
  ).filter(
    (el) =>
      typeof el.getTotalLength === "function" &&
      (el.getAttribute("d") ?? "") !== "",
  );

  function insideSection(point) {
    return (
      point.x >= sectionRect.left &&
      point.x <= sectionRect.right &&
      point.y >= sectionRect.top &&
      point.y <= sectionRect.bottom
    );
  }

  /* A coarse pass over each path's full length, in SCREEN space, to find which arc-length ranges
     land inside this section's rect. A page-length path spends most of its length in other
     sections; sampling the full fine budget against the whole path would starve the section under
     test of resolution, so each in-rect range becomes its own "segment" for the fine pass below. */
  const COARSE_STEPS = 400;
  const segments = [];
  for (const path of candidatePaths) {
    let len = 0;
    try {
      len = path.getTotalLength();
    } catch {
      len = 0;
    }
    const ctm = path.getScreenCTM();
    if (len <= 0 || !ctm) continue;
    const step = len / COARSE_STEPS;
    let runStart = null;
    for (let i = 0; i <= COARSE_STEPS; i += 1) {
      const distanceAlong = Math.min(len, i * step);
      const screenPoint = path
        .getPointAtLength(distanceAlong)
        .matrixTransform(ctm);
      const inside = insideSection(screenPoint);
      if (inside && runStart === null) {
        runStart = Math.max(0, distanceAlong - step);
      } else if (!inside && runStart !== null) {
        const runEnd = Math.min(len, distanceAlong + step);
        if (runEnd > runStart)
          segments.push({ path, start: runStart, end: runEnd });
        runStart = null;
      }
    }
    if (runStart !== null && len > runStart) {
      segments.push({ path, start: runStart, end: len });
    }
  }

  if (segments.length === 0) {
    return { noThread: true, glyphCount: glyphRects.length };
  }
  if (glyphRects.length === 0) {
    return {
      noText: true,
      pathCount: new Set(segments.map((segment) => segment.path)).size,
    };
  }

  const segmentLengths = segments.map((segment) => segment.end - segment.start);
  const totalLength = segmentLengths.reduce((sum, len) => sum + len, 0);

  /* Largest-remainder apportionment: every segment with positive length gets at least its two
     endpoints, and the remaining samples go to whichever segments' fair shares had the largest
     fractional remainder, until the budget is exactly spent. */
  let counts = segmentLengths.map(() => 0);
  if (totalLength > 0) {
    const fair = segmentLengths.map(
      (len) => (len / totalLength) * sampleBudget,
    );
    counts = fair.map((share, i) =>
      segmentLengths[i] > 0 ? Math.max(2, Math.floor(share)) : 0,
    );
    let used = counts.reduce((sum, count) => sum + count, 0);
    const remainders = fair
      .map((share, i) => ({ i, frac: share - Math.floor(share) }))
      .filter((entry) => segmentLengths[entry.i] > 0)
      .sort((a, b) => b.frac - a.frac);
    let cursor = 0;
    while (used < sampleBudget && cursor < remainders.length) {
      counts[remainders[cursor].i] += 1;
      used += 1;
      cursor += 1;
    }
  }

  function pointRectDistance(x, y, rect) {
    const dx = Math.max(rect.left - x, 0, x - rect.right);
    const dy = Math.max(rect.top - y, 0, y - rect.bottom);
    return Math.hypot(dx, dy);
  }

  let minDistance = Infinity;
  let offendingText = null;
  let offendingPoint = null;
  let sampled = 0;

  segments.forEach((segment, i) => {
    const n = counts[i];
    if (n === 0) {
      return;
    }
    const ctm = segment.path.getScreenCTM();
    if (!ctm) {
      return;
    }
    const span = segment.end - segment.start;
    for (let k = 0; k < n; k += 1) {
      const distanceAlong =
        segment.start + (n === 1 ? 0 : (span * k) / (n - 1));
      const localPoint = segment.path.getPointAtLength(distanceAlong);
      const screenPoint = localPoint.matrixTransform(ctm);
      sampled += 1;
      for (const rect of glyphRects) {
        const distance = pointRectDistance(screenPoint.x, screenPoint.y, rect);
        if (distance < minDistance) {
          minDistance = distance;
          offendingText = rect.text;
          offendingPoint = { x: screenPoint.x, y: screenPoint.y };
        }
      }
    }
  });

  return {
    minDistance: Number.isFinite(minDistance) ? minDistance : null,
    sampled,
    pathCount: new Set(segments.map((segment) => segment.path)).size,
    glyphCount: glyphRects.length,
    offendingText,
    offendingPoint,
  };
}

/* Runs inside the page, for `--falsify` only. Plants a synthetic thread SVG — matching this
   gate's own selector convention — spanning exactly a heading's rect, with a path straight
   through its centre. Appended as a child of the SECTION (not `document.body`), so it is inside
   the scope `measureSectionInPage` queries; `position: fixed` still places it at the heading's
   real screen coordinates regardless of where in the DOM it lives. */
function plantViolationInPage(sectionSelector) {
  const section = document.querySelector(sectionSelector);
  if (!section) {
    return {
      error: `no element matching "${sectionSelector}" found in the DOM`,
    };
  }
  const heading = section.querySelector("h1, h2");
  if (!heading) {
    return {
      error: `no heading in "${sectionSelector}" to plant a violation through`,
    };
  }
  const rect = heading.getBoundingClientRect();
  const svgNs = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNs, "svg");
  svg.setAttribute("data-thread-svg", "true");
  svg.setAttribute("data-injected-falsify", "true");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  svg.style.position = "fixed";
  svg.style.left = `${rect.left}px`;
  svg.style.top = `${rect.top}px`;
  svg.style.width = `${rect.width}px`;
  svg.style.height = `${rect.height}px`;
  svg.style.pointerEvents = "none";
  const path = document.createElementNS(svgNs, "path");
  path.setAttribute("d", "M0,50 L100,50");
  svg.appendChild(path);
  section.appendChild(svg);
  return { ok: true, headingText: heading.textContent.trim().slice(0, 60) };
}

/* Step 2's own in-page probe: the bride parent row, at whatever viewport the caller has already
   set. Isolated from `measureSectionInPage` because it measures a distance between two named text
   elements rather than a thread-path-to-text distance — a different question, asked only to
   validate the measuring machinery itself.

   IT RETURNS THE GAP *AND* THE THREE QUANTITIES THAT PREDICT IT, because the gap is a RESIDUAL
   rather than a value anything sets, and Step 2 asserts the derivation rather than a remembered
   number. Every figure here is measured off the page -- no token is read and no constant is
   carried -- since a number computed from the model only ever proves self-consistency. */
function measureBrideParentGapInPage() {
  const nameSpans = Array.from(document.querySelectorAll("#family .type-body"));
  if (nameSpans.length < 2) {
    return {
      error: `expected at least 2 ".type-body" spans under #family, found ${nameSpans.length}`,
    };
  }
  const [motherSpan, fatherSpan] = nameSpans;

  /* The two parents are separate portraits in one grid, so the geometry that predicts the gap is
     the grid's own: each column is a portrait diameter wide and the columns are one `--couple-gap`
     apart. Both are taken from the `<li>` rects rather than from the custom properties that set
     them -- the rendered column is the thing the names are actually centred on. */
  const motherItem = motherSpan.closest("li");
  const fatherItem = fatherSpan.closest("li");
  if (motherItem === null || fatherItem === null) {
    return {
      error:
        "the parent names are no longer inside grid items -- Family's markup changed, so re-derive this probe rather than patching it",
    };
  }

  /* `getClientRects()` over a text node's range gives the LINE BOX, not the ink: advance widths
     with the glyphs' own side bearings inside them. That is the right instrument here, because the
     closed form below is in advance widths -- but it is not a measure of ink, and this function is
     named for what it returns rather than for what a reader might hope it returns. */
  function lineBoxesOf(element) {
    const rects = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if (node.nodeValue && node.nodeValue.trim() !== "") {
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          if (rect.width > 0 && rect.height > 0) {
            rects.push(rect);
          }
        }
      }
      node = walker.nextNode();
    }
    return rects;
  }

  const motherRects = lineBoxesOf(motherSpan);
  const fatherRects = lineBoxesOf(fatherSpan);
  if (motherRects.length === 0 || fatherRects.length === 0) {
    return {
      error: `no line boxes found (mother: ${motherRects.length}, father: ${fatherRects.length})`,
    };
  }

  function rectRectDistance(a, b) {
    const dx = Math.max(a.left - b.right, b.left - a.right, 0);
    const dy = Math.max(a.top - b.bottom, b.top - a.bottom, 0);
    return Math.hypot(dx, dy);
  }

  let minDistance = Infinity;
  for (const a of motherRects) {
    for (const b of fatherRects) {
      const distance = rectRectDistance(a, b);
      if (distance < minDistance) {
        minDistance = distance;
      }
    }
  }

  const motherItemRect = motherItem.getBoundingClientRect();
  const fatherItemRect = fatherItem.getBoundingClientRect();
  const columnWidth = motherItemRect.width;
  const columnGap = fatherItemRect.left - motherItemRect.right;
  const motherWidth = motherSpan.getBoundingClientRect().width;
  const fatherWidth = fatherSpan.getBoundingClientRect().width;

  /* A zero here would make the prediction below arithmetically fine and physically meaningless, so
     it fails loudly instead. An empty read that defaults to 0 is how this class of probe passes
     while measuring nothing. */
  const zeroed = Object.entries({
    columnWidth,
    columnGap,
    motherWidth,
    fatherWidth,
  })
    .filter(([, value]) => !Number.isFinite(value) || value <= 0)
    .map(([name, value]) => `${name}=${value}`);
  if (zeroed.length > 0) {
    return {
      error: `a measured input is missing or zero (${zeroed.join(", ")}) -- the probe is not reaching the rendered row`,
    };
  }

  return {
    minDistance,
    columnWidth,
    columnGap,
    motherWidth,
    fatherWidth,
    motherText: motherSpan.textContent.trim(),
    fatherText: fatherSpan.textContent.trim(),
  };
}

/* Step 2 asserts the gap's DERIVATION, not a recorded constant -- and the reason is the whole point
   of the step, so it is written here rather than left to a work doc.

   This step used to hard-assert 4.5px +/- 0.1 (recorded 2026-09-20) and had been failing for weeks
   against a stable, reproducible 9.391px. The constant was VOID rather than stale: the gap between
   the two parent names is not a value anything sets, it is what is LEFT OVER once the grid's two
   columns and the two rendered names are placed --

     gap = (column width + column gap) - (mother name width + father name width) / 2

   -- so it moves whenever the type, the roster or the diameter moves. `--text-body` was 17px when
   4.5 was recorded and is 13px now, which renders both names narrower and the gap wider; the names
   and every geometry token are unchanged over the same span. 4.5 was therefore one figure in a set
   the type change falsified, and the only one that had been pinned into a gate as a hard tolerance
   instead of being re-recorded.

   Re-recording 9.391 would buy one pass and fail again on the next type or roster change -- and the
   full-resolution portrait delivery is already queued to cause one. Asserting the derivation instead
   validates the machinery against something that stays true, and it still fails loudly if the probe
   stops reaching the rendered row.

   The tolerance is 1px, not an equality: the engine quantises layout to 1/64px and the two sides
   come from different box types (a line box against two element rects), so an exact match would be
   brittle for nothing. Today's residual is about 0.01px. */
async function runValidate(browser) {
  console.log(
    "Step 2 — validating the measuring machinery against the gap's own derivation.",
  );
  console.log(
    'Target: Family, bride parent row, "Minimol Roy" vs "Roy John Edatt", phone tier (390px).',
  );
  console.log(
    "Asserting: measured gap === (column width + column gap) − mean name width, within 1px.\n",
  );

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  let exitCode = 1;
  try {
    await page.goto(`${ORIGIN}${LAB_ROUTE}`, {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT_MS,
    });
    await waitForFonts(page);
    await page.waitForTimeout(SETTLE_MS);
    const result = await page.evaluate(measureBrideParentGapInPage);

    if (result.error) {
      console.log(`FAIL — ${result.error}`);
      exitCode = 1;
    } else {
      const meanName = (result.motherWidth + result.fatherWidth) / 2;
      const predicted = result.columnWidth + result.columnGap - meanName;
      const residual = Math.abs(result.minDistance - predicted);
      console.log(`  "${result.motherText}" vs "${result.fatherText}"`);
      console.log(
        `  column:   ${result.columnWidth.toFixed(3)}px wide, ${result.columnGap.toFixed(3)}px apart`,
      );
      console.log(
        `  names:    ${result.motherWidth.toFixed(3)}px and ${result.fatherWidth.toFixed(3)}px (mean ${meanName.toFixed(3)}px)`,
      );
      console.log(`  predicted: ${predicted.toFixed(3)}px`);
      console.log(`  measured:  ${result.minDistance.toFixed(3)}px`);
      console.log(`  residual:  ${residual.toFixed(3)}px`);
      /* Today's value, recorded as today's value and not as the law: 9.391px, measured 2026-10-08
         at 390x844 on the lab route, Chromium pinned to `channel: "chromium"`. It is here so a
         reader can see at a glance whether the row has moved since; it is NOT what is asserted. */
      console.log("  (for reference, the gap measured 9.391px on 2026-10-08)");
      if (residual <= 1) {
        console.log(
          "\nPASS — the measured gap matches the geometry that produces it.",
        );
        exitCode = 0;
      } else {
        console.log(
          "\nFAIL — the measured gap does NOT match the geometry that produces it. Per this " +
            "step's own rule, do not tune the measurement toward either number: a residual this " +
            "large means the probe and the layout disagree about what they are measuring, and " +
            "that disagreement needs its own diagnosis before this gate can be trusted. The " +
            "likeliest cause is Family's markup having changed shape, since the prediction reads " +
            "the grid items the names sit in.",
        );
        exitCode = 1;
      }
    }
  } finally {
    await page.close();
  }
  return exitCode;
}

async function runFalsify(browser, sectionId, bandKey, windowKey) {
  const tier = BANDS.find((candidate) => candidate.key === bandKey) ?? BANDS[0];
  const orientation =
    tier.windows.find((candidate) => candidate.key === windowKey) ??
    tier.windows[0];
  const width = orientation.width;
  const height = orientation.height;

  console.log(
    "Step 3 — falsifying the gate: planting a violation and confirming it is caught.",
  );
  console.log(
    `Target: #${sectionId}, ${tier.key}/${orientation.key} (${width}x${height}).\n`,
  );

  const page = await browser.newPage({ viewport: { width, height } });
  let exitCode = 1;
  try {
    await page.goto(`${ORIGIN}${LAB_ROUTE}`, {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT_MS,
    });
    await waitForFonts(page);
    await waitForThreadMeasured(page);
    await page.waitForTimeout(SETTLE_MS);

    const planted = await page.evaluate(
      plantViolationInPage,
      sectionSelectorFor(sectionId),
    );
    if (planted.error) {
      console.log(`FAIL — could not plant a violation: ${planted.error}`);
      return 1;
    }
    console.log(`  planted a path straight through: "${planted.headingText}"`);

    await page.waitForTimeout(SETTLE_MS);
    const result = await page.evaluate(measureSectionInPage, {
      sectionSelector: sectionSelectorFor(sectionId),
      threadSelector: THREAD_SELECTOR,
      sampleBudget: SAMPLE_BUDGET,
    });

    if (result.error) {
      console.log(`FAIL — measurement error: ${result.error}`);
      return 1;
    }
    if (result.noThread) {
      console.log(
        "FAIL — the planted path was not found by the gate's own selector.",
      );
      return 1;
    }

    console.log(
      `  measured minimum clearance: ${result.minDistance?.toFixed(3) ?? "null"}px`,
    );
    console.log(`  offending text: "${result.offendingText ?? "none"}"`);

    if (result.minDistance !== null && result.minDistance <= 0) {
      console.log(
        `\nPASS — the gate reports a violation: section="${sectionId}", ` +
          `tier="${tier.key}/${orientation.key}", distance=${result.minDistance.toFixed(3)}px.`,
      );
      exitCode = 0;
    } else {
      console.log(
        "\nFAIL — a path planted straight through a heading was NOT reported as a " +
          "violation. The gate has not been proven to catch a real crossing.",
      );
      exitCode = 1;
    }
  } finally {
    await page.close();
  }
  return exitCode;
}

async function runSweep(browser, sections) {
  const findings = [];
  const noThreadSections = new Set();

  for (const sectionId of sections) {
    console.log(`\n#${sectionId}`);
    const initialWidth = BANDS[0].windows[0].width;
    const initialHeight = BANDS[0].windows[0].height;
    const page = await browser.newPage({
      viewport: { width: initialWidth, height: initialHeight },
    });
    try {
      await page.goto(`${ORIGIN}${LAB_ROUTE}`, {
        waitUntil: "domcontentloaded",
        timeout: NAV_TIMEOUT_MS,
      });
      await waitForFonts(page);
      await waitForThreadMeasured(page);

      for (const tier of BANDS) {
        for (const orientation of tier.windows) {
          const width = orientation.width;
          const height = orientation.height;
          await page.setViewportSize({ width, height });
          await page.waitForTimeout(SETTLE_MS);

          const result = await page.evaluate(measureSectionInPage, {
            sectionSelector: sectionSelectorFor(sectionId),
            threadSelector: THREAD_SELECTOR,
            sampleBudget: SAMPLE_BUDGET,
          });

          const label = `  ${tier.key}/${orientation.key} (${width}x${height})`;

          if (result.error) {
            console.log(`${label}  ERROR  ${result.error}`);
            findings.push({
              sectionId,
              tier: tier.key,
              orientation: orientation.key,
              kind: "error",
              detail: result.error,
            });
            continue;
          }
          if (result.noThread) {
            console.log(
              `${label}  NO_THREAD  (${result.glyphCount} glyph rects present)`,
            );
            noThreadSections.add(sectionId);
            continue;
          }
          if (result.noText) {
            console.log(
              `${label}  ok  (no text to check against; ${result.pathCount} thread path(s))`,
            );
            continue;
          }

          const clean = result.minDistance === null || result.minDistance > 0;
          console.log(
            `${label}  ${clean ? "ok" : "VIOLATION"}  clearance=${result.minDistance?.toFixed(3) ?? "null"}px` +
              (clean ? "" : `  crossing "${result.offendingText}"`),
          );
          if (!clean) {
            findings.push({
              sectionId,
              tier: tier.key,
              orientation: orientation.key,
              kind: "violation",
              distance: result.minDistance,
              text: result.offendingText,
            });
          }
        }
      }
    } finally {
      await page.close();
    }
  }

  return { findings, noThreadSections };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!(await isDevServerUp())) {
    console.error(
      `No dev server answered at ${ORIGIN}. This script never starts or stops it — it belongs ` +
        "to whoever is reviewing live. Start it yourself (`npm run dev`) and re-run.",
    );
    process.exit(1);
  }

  const browser = await chromium.launch({ channel: "chromium" });
  try {
    if (args.validate) {
      process.exit(await runValidate(browser));
    }

    if (args.falsify) {
      const sectionId = args.section ?? "family";
      const tierKey = args.band ?? BANDS[0].key;
      const orientationKey = args.orientation ?? "nominal";
      process.exit(
        await runFalsify(browser, sectionId, tierKey, orientationKey),
      );
    }

    const sections = args.section ? [args.section] : SECTION_IDS;
    console.log(
      `Thread type-clearance gate — ${sections.length} section(s) x ${BANDS.length} aspect bands x ` +
        `${BANDS[0].windows.length} windows = ${sections.length * BANDS.length * BANDS[0].windows.length} checks.`,
    );
    console.log(`Selector: ${THREAD_SELECTOR}\n`);

    const { findings, noThreadSections } = await runSweep(browser, sections);

    console.log("\n---");
    if (noThreadSections.size > 0) {
      console.log(
        `NO_THREAD: ${[...noThreadSections].join(", ")} — no element matching "${THREAD_SELECTOR}" ` +
          "was found. Expected until Task 10 mounts <SectionThread> with that convention; treated " +
          "as a failure here rather than a silent pass on an empty set.",
      );
    }
    const violations = findings.filter(
      (finding) => finding.kind === "violation",
    );
    const errors = findings.filter((finding) => finding.kind === "error");
    if (violations.length > 0) {
      console.log(`VIOLATIONS (${violations.length}):`);
      for (const violation of violations) {
        console.log(
          `  ${violation.sectionId} @ ${violation.tier}/${violation.orientation}: ` +
            `${violation.distance.toFixed(3)}px into "${violation.text}"`,
        );
      }
    }
    if (errors.length > 0) {
      console.log(`ERRORS (${errors.length}):`);
      for (const error of errors) {
        console.log(
          `  ${error.sectionId} @ ${error.tier}/${error.orientation}: ${error.detail}`,
        );
      }
    }

    const clean =
      noThreadSections.size === 0 &&
      violations.length === 0 &&
      errors.length === 0;
    console.log(clean ? "\nPASS — clean." : "\nFAIL.");
    process.exit(clean ? 0 : 1);
  } finally {
    await browser.close();
  }
}

await main();
