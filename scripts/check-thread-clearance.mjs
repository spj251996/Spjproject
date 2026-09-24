#!/usr/bin/env node
/* The type-clearance gate (Phase 5b, Task 8): the thread may cross the ring, the mount, any
   stock, any botanical piece — but never type. This re-runnable script proves that at eight
   tier/orientation combinations per section.

   SELECTOR CONVENTION THIS GATE ASSUMES (the thread is not mounted yet — Task 10 mounts it):
   every SVG element that draws part of the thread — each motif's own square SVG, each
   connector's own stretched SVG — carries `data-thread-svg` on its OWN <svg> root. This gate
   queries `section#<id> svg[data-thread-svg] path` for the drawn geometry. Icons already carry
   `aria-hidden` (see `components/icons/icon-base.tsx`), so `aria-hidden` alone cannot
   distinguish thread SVGs from decorative ones — `data-thread-svg` is the hook Task 10 (the
   cutover) must add to `<SectionThread>`'s rendered SVG roots for this gate to find anything.
   Until then, every section legitimately reports NO_THREAD — that is the correct, honest result
   of running this gate today, not a bug in it. Steps 2 and 3 below are what prove the gate's
   *machinery* works, independent of the thread's own existence.

   METHOD, per section per tier/orientation:
     1. Collect every thread <path> in the section (via the convention above). Get each path's
        total length (`SVGGeometryElement.getTotalLength`) and apportion a 200-point sample
        budget across every path by arc length (largest-remainder method), so a long connector
        gets more samples than a short motif rather than each path getting an equal share
        regardless of size.
     2. Map every sampled point from the path's own user space into viewport (screen)
        coordinates via `getPointAtLength(...).matrixTransform(path.getScreenCTM())` — three of
        the real thread's own SVGs are non-uniformly scaled (`preserveAspectRatio="none"`
        connectors), so an unmapped point would simply be wrong.
     3. Collect every GLYPH rect in the section — `Range.getClientRects()` over each visible
        text node, never an element's bounding box: a wrapper span is as wide as its column plus
        any overrun allowance, so bounding boxes report collisions that are not there.
     4. Report the minimum point-to-rect distance across every sampled point and every glyph
        rect. A distance of 0 (a sampled point on or inside a glyph rect) is a crossing —
        the one thing the placement rule forbids outright; being close is wanted, not flagged.

   ENGINE PIN (mandatory): `chromium.launch({ channel: "chromium" })`. The default launch reaches
   for Chromium's old `headless_shell`, which quantises glyph advances and renders text ~3%
   wider — every overflow figure taken without this pin on this project has been an artifact of
   the launch, not the page. Any measurement here without the pin is void.

   CAPS (no unbounded waits, no loops that iterate until they look right):
     - 6 sections x 4 width tiers x 2 orientations = 48 checks per full sweep — a fixed, finite
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
     node scripts/check-thread-clearance.mjs --falsify --section=wishes --tier=tablet --orientation=landscape
*/

import { chromium } from "playwright";

const ORIGIN = "http://localhost:3000";
const NAV_TIMEOUT_MS = 15_000;
const FONT_TIMEOUT_MS = 5_000;
const SETTLE_MS = 200;
const SAMPLE_BUDGET = 200;

const THREAD_SELECTOR = "svg[data-thread-svg] path";

/* The invite section carries no `id` (it is the page's first section, and nothing else has
   needed to address it) — every other section does. `sectionSelectorFor` is the one place this
   exception lives; everywhere else in this script deals in the plain `ThreadId`-shaped name. */
function sectionSelectorFor(sectionId) {
  if (sectionId === "invite") {
    return "main > section:first-of-type";
  }
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

/* Real device-ish widths (matching the ones already used across `tmp/botanical-verify/*.mjs`),
   not the breakpoint-avoiding widths `measure-section-fit.mjs` uses for its own different
   purpose (sweeping fit regimes). This gate cares about what a guest's actual device renders. */
const TIERS = [
  { key: "phone", width: 390 },
  { key: "tablet", width: 834 },
  { key: "laptop", width: 1280 },
  { key: "desktop", width: 1920 },
];

const ORIENTATIONS = [
  { key: "portrait", heightFor: (width) => Math.round(width * 1.5) },
  { key: "landscape", heightFor: (width) => Math.round(width * 0.6) },
];

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

  const paths = Array.from(section.querySelectorAll(threadSelector)).filter(
    (el) => typeof el.getTotalLength === "function",
  );

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

  if (paths.length === 0) {
    return { noThread: true, glyphCount: glyphRects.length };
  }
  if (glyphRects.length === 0) {
    return { noText: true, pathCount: paths.length };
  }

  const lengths = paths.map((path) => {
    try {
      return path.getTotalLength();
    } catch {
      return 0;
    }
  });
  const totalLength = lengths.reduce((sum, len) => sum + len, 0);

  /* Largest-remainder apportionment: every path with positive length gets at least its two
     endpoints, and the remaining samples go to whichever paths' fair shares had the largest
     fractional remainder, until the budget is exactly spent. */
  let counts = lengths.map(() => 0);
  if (totalLength > 0) {
    const fair = lengths.map((len) => (len / totalLength) * sampleBudget);
    counts = fair.map((share, i) =>
      lengths[i] > 0 ? Math.max(2, Math.floor(share)) : 0,
    );
    let used = counts.reduce((sum, count) => sum + count, 0);
    const remainders = fair
      .map((share, i) => ({ i, frac: share - Math.floor(share) }))
      .filter((entry) => lengths[entry.i] > 0)
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

  paths.forEach((path, i) => {
    const len = lengths[i];
    const n = counts[i];
    if (n === 0 || len <= 0) {
      return;
    }
    const ctm = path.getScreenCTM();
    if (!ctm) {
      return;
    }
    for (let k = 0; k < n; k += 1) {
      const distanceAlong = n === 1 ? 0 : (len * k) / (n - 1);
      const localPoint = path.getPointAtLength(distanceAlong);
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
    pathCount: paths.length,
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

/* Step 2's own in-page probe: the bride parent row's two glyph-rect sets, at whatever viewport
   the caller has already set. Isolated from `measureSectionInPage` because it measures a
   rect-to-rect distance between two named text elements, not a thread-path-to-text distance —
   a different question, asked only to validate the glyph-rect machinery itself. */
function measureBrideParentGapInPage() {
  const nameSpans = Array.from(document.querySelectorAll("#family .type-body"));
  if (nameSpans.length < 2) {
    return {
      error: `expected at least 2 ".type-body" spans under #family, found ${nameSpans.length}`,
    };
  }
  const [motherSpan, fatherSpan] = nameSpans;

  function glyphRectsOf(element) {
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

  const motherRects = glyphRectsOf(motherSpan);
  const fatherRects = glyphRectsOf(fatherSpan);
  if (motherRects.length === 0 || fatherRects.length === 0) {
    return {
      error: `no glyph rects found (mother: ${motherRects.length}, father: ${fatherRects.length})`,
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

  return {
    minDistance,
    motherText: motherSpan.textContent.trim(),
    fatherText: fatherSpan.textContent.trim(),
  };
}

async function runValidate(browser) {
  console.log(
    "Step 2 — validating the glyph-rect machinery against a recorded figure.",
  );
  console.log(
    'Target: Family, bride parent row, "Minimol Roy" vs "Roy John Edatt", phone tier (390px).',
  );
  console.log(
    "Recorded (2026-09-20, Libre Baskerville): 4.5px. Expected here: 4.5px ± 0.1.\n",
  );

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  let exitCode = 1;
  try {
    await page.goto(`${ORIGIN}/`, {
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
      const delta = Math.abs(result.minDistance - 4.5);
      console.log(`  "${result.motherText}" vs "${result.fatherText}"`);
      console.log(`  measured: ${result.minDistance.toFixed(3)}px`);
      console.log(`  recorded: 4.5px`);
      console.log(`  delta:    ${delta.toFixed(3)}px`);
      if (delta <= 0.1) {
        console.log("\nPASS — the harness reproduces the recorded figure.");
        exitCode = 0;
      } else {
        console.log(
          "\nFAIL — the harness does NOT reproduce the recorded figure. Per the task's " +
            "instructions this is reported, not tuned toward: do not adjust the measurement " +
            "code to hit 4.5px. Something about this harness's glyph-rect method disagrees " +
            "with the one that produced 4.5px, and that disagreement needs its own diagnosis " +
            "before this gate can be trusted.",
        );
        exitCode = 1;
      }
    }
  } finally {
    await page.close();
  }
  return exitCode;
}

async function runFalsify(browser, sectionId, tierKey, orientationKey) {
  const tier = TIERS.find((candidate) => candidate.key === tierKey) ?? TIERS[0];
  const orientation =
    ORIENTATIONS.find((candidate) => candidate.key === orientationKey) ??
    ORIENTATIONS[0];
  const width = tier.width;
  const height = orientation.heightFor(width);

  console.log(
    "Step 3 — falsifying the gate: planting a violation and confirming it is caught.",
  );
  console.log(
    `Target: #${sectionId}, ${tier.key}/${orientation.key} (${width}x${height}).\n`,
  );

  const page = await browser.newPage({ viewport: { width, height } });
  let exitCode = 1;
  try {
    await page.goto(`${ORIGIN}/`, {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT_MS,
    });
    await waitForFonts(page);
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
    const initialWidth = TIERS[0].width;
    const initialHeight = ORIENTATIONS[0].heightFor(initialWidth);
    const page = await browser.newPage({
      viewport: { width: initialWidth, height: initialHeight },
    });
    try {
      await page.goto(`${ORIGIN}/`, {
        waitUntil: "domcontentloaded",
        timeout: NAV_TIMEOUT_MS,
      });
      await waitForFonts(page);

      for (const tier of TIERS) {
        for (const orientation of ORIENTATIONS) {
          const width = tier.width;
          const height = orientation.heightFor(width);
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
      const tierKey = args.tier ?? "phone";
      const orientationKey = args.orientation ?? "portrait";
      process.exit(
        await runFalsify(browser, sectionId, tierKey, orientationKey),
      );
    }

    const sections = args.section ? [args.section] : SECTION_IDS;
    console.log(
      `Thread type-clearance gate — ${sections.length} section(s) x ${TIERS.length} tiers x ` +
        `${ORIENTATIONS.length} orientations = ${sections.length * TIERS.length * ORIENTATIONS.length} checks.`,
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
