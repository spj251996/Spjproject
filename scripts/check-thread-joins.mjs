#!/usr/bin/env node
/* The join gate (Phase 5b): a section's thread must render as ONE connected run of ink.
 *
 * WHY A RENDER AND NOT A TEST. Two defects shipped past 137 unit tests, a clean `tsc`, clean lint
 * and a green build, and the owner found both by looking at the page:
 *   - every reveal mask is butt-capped and stops at its path's last point, while the visible stroke
 *     is round-capped and reaches half a stroke width further, so two masks meeting at a join each
 *     cut half a cap away and left a slit of ivory between them;
 *   - a connector composed against a nominal tier box and a motif field sized from the real window
 *     disagreed about where the join was by 3px at one viewport and 67px at another.
 * Neither is visible to anything that does not rasterise the page. Connected-component analysis is:
 * a break of one pixel anywhere splits the run in two, wherever it is and whatever caused it.
 *
 * METHOD, per section per viewport per state:
 *   1. Park the section and screenshot it (the element, not the viewport — a section is taller than
 *      the window and a viewport shot would cut the thread at the fold and report a false break).
 *   2. Mark every ink pixel. The test is a RED-DOMINANT one rather than a window around the thread's
 *      own hex, so a half-covered antialiased edge counts as ink and does not read as a break; the
 *      gold eyebrow (r-g = 35) and the dark dev-tools badge both fall outside it.
 *   3. Label 8-connected components with NO dilation. Dilating bridges a one-pixel gap, which is
 *      exactly the defect this gate exists to see.
 *   4. One component, of any size over a few pixels, is a pass.
 *
 * STATES. `rest` emulates reduced motion, which removes the animation and lands the sheet on its
 * complete base; `scrub` parks the section mid-band with the animation live. A masking-geometry
 * defect shows in both, a scrub-law one only in the second — running both is what tells them apart.
 *
 * ENGINE PIN (mandatory): `chromium.launch({ channel: "chromium" })`. The default launch reaches
 * for Chromium's old `headless_shell`, whose glyph and edge rendering differ; every measurement on
 * this project taken without the pin has been an artifact of the launch.
 *
 * DEV SERVER: never started, stopped or restarted here — :3000 is the owner's. If nothing answers,
 * the script says so and exits rather than spawning its own.
 *
 * ROUTE: `/thread-lab` by default, because the thread is not mounted on `/` until the cutover
 * (Task 10). Point it at `/` with `--route=/` once it is, and the gate is unchanged.
 *
 * CAPS: a fixed 7 sections x 2 viewports per aspect band x 2 states, navigation 20s, fonts 5s
 * best-effort, one fixed 350ms settle after each park. No convergence loops, no unbounded waits.
 *
 * USAGE:
 *   node scripts/check-thread-joins.mjs
 *   node scripts/check-thread-joins.mjs --section=family --viewport=tall-nominal
 *   node scripts/check-thread-joins.mjs --falsify     # prove the gate can see a break
 */

import { chromium } from "playwright";
import sharp from "sharp";
import { THREAD_BANDS } from "../components/thread/thread-bands.ts";

const ORIGIN = "http://localhost:3000";
const NAV = 20000;
const SETTLE = 350;

const SECTIONS = [
  "invite",
  "event-info",
  "contact",
  "family",
  "celebrations",
  "wishes",
  "not-found",
];

/* One window per ASPECT BAND, not per width tier: thread geometry is emitted per band now, so a
   sweep keyed to widths could miss a band entirely. Each band contributes its own NOMINAL box —
   where the emitted geometry renders 1:1 and a join is exact by construction — and one real window
   that DRIFTS from it inside the same band, which is where a masking or pinning defect shows. */
const DRIFTED = {
  tall: { width: 360, height: 780, dpr: 2 },
  upright: { width: 768, height: 1024, dpr: 1 },
  wide: { width: 1280, height: 720, dpr: 1 },
};

const VIEWPORTS = THREAD_BANDS.flatMap((band) => [
  {
    name: `${band.id}-nominal`,
    width: band.box.width,
    height: band.box.height,
    dpr: band.box.width < 500 ? 2 : 1,
  },
  { name: `${band.id}-drifted`, ...DRIFTED[band.id] },
]);

/* THE ONE RECORDED EXCEPTION, and it belongs to the SEEDED ROUTE rather than to the renderer.
 *
 * A motif is turned onto the route it sits on, which turns its two attachment points with it and
 * throws the drawing's whole chord onto the axis the route travels. Where two consecutive
 * attachment points then invert, the connector between them has no geometry left: its curve is
 * normalised once per band against that band's nominal box, and `event-info`'s seeded `rings`
 * (scale 0.44) and `knot` (0.29), two rows apart on a four-row grid, invert at
 * `r = svmin / section height = 0.6849` — while the `upright` band's own box sits at 0.6949. The
 * connector is composed 0.9 px long, under the generator's own 1 px floor, and renders in pieces.
 *
 * NOT CLAMPED, deliberately. An angle limited to whatever the seeded scales survive would hide from
 * the owner the one thing they need in order to tune away from it. The remedy is a scale or a cell,
 * both of which are the owner's to set on the grid panel — this gate records the consequence, it
 * does not choose a value. The same crossing is pinned in the suite by
 * `every connector the turn inverts is one the source names`.
 *
 * A RECORDED CASE THAT STOPS BREAKING FAILS THE GATE, so tuning it away deletes the entry rather
 * than leaving a dead exemption behind. `wide` is NOT listed: it is far past the same crossing and
 * still renders as one run, because the two turned motifs overlap enough to touch. */
const CROSSINGS = new Map([
  [
    "event-info upright-nominal",
    "rings/knot invert at r = 0.6849; the upright band composes at 0.6949",
  ],
]);

const flag = (name, fallback = null) => {
  const found = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return found === undefined ? fallback : found.slice(name.length + 3);
};
const route = flag("route", "/thread-lab");
const falsify = process.argv.includes("--falsify");
const only = flag("section");
const onlyViewport = flag("viewport");

/* Thread red against ivory, with its antialiased edge: red-dominant and not pale. The gold eyebrow
   (#b08d57, r-g = 35) and the dev badge (near-neutral) are outside it. */
function isInk(r, g, b) {
  return g < 150 && r - g > 60 && r - b > 60;
}

function components(data, width, height, channels) {
  const ink = new Uint8Array(width * height);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const at = pixel * channels;
    if (isInk(data[at], data[at + 1], data[at + 2])) ink[pixel] = 1;
  }
  const seen = new Uint8Array(width * height);
  const found = [];
  for (let start = 0; start < width * height; start += 1) {
    if (!ink[start] || seen[start]) continue;
    let size = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    const stack = [start];
    seen[start] = 1;
    while (stack.length > 0) {
      const pixel = stack.pop();
      size += 1;
      const y = Math.floor(pixel / width);
      const x = pixel - y * width;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny < 0 || ny >= height || nx < 0 || nx >= width) continue;
          const next = ny * width + nx;
          if (ink[next] && !seen[next]) {
            seen[next] = 1;
            stack.push(next);
          }
        }
      }
    }
    /* A handful of pixels is antialiasing noise, not a piece of thread. */
    if (size > 12) found.push({ size, box: [minX, minY, maxX, maxY] });
  }
  return found.sort((a, b) => b.size - a.size);
}

const reachable = await fetch(`${ORIGIN}${route}`, {
  signal: AbortSignal.timeout(NAV),
})
  .then((response) => response.ok)
  .catch(() => false);
if (!reachable) {
  console.error(
    `check-thread-joins: nothing answers on ${ORIGIN}${route}. Start the dev server yourself — this script never does.`,
  );
  process.exit(2);
}

const browser = await chromium.launch({ channel: "chromium" });
/* `rest` and `scrub` are named once: the loop and the coverage assertion below read the
   same list, so neither can drift from the other. */
const STATES = ["rest", "scrub"];
const failures = [];
/* Which recorded crossings this run actually saw break, and which have stopped breaking — the
   second set is what keeps the record from outliving the route that caused it. */
const crossed = new Set();
const mended = new Set();
let measured = 0;
try {
  for (const viewport of VIEWPORTS) {
    if (onlyViewport !== null && viewport.name !== onlyViewport) continue;
    for (const state of STATES) {
      const page = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: viewport.dpr,
        reducedMotion: state === "rest" ? "reduce" : "no-preference",
      });
      page.setDefaultTimeout(NAV);
      await page.goto(`${ORIGIN}${route}`, {
        waitUntil: "load",
        timeout: NAV,
      });
      await page
        .evaluate(() => document.fonts.ready)
        .catch(() =>
          console.warn("  fonts did not settle; geometry is unaffected"),
        );

      if (falsify) {
        /* Step 3: break every connector on purpose. A gate that cannot see this cannot see the
           defect it is here for, and a run that passes under --falsify is the gate failing. */
        await page.addStyleTag({
          content: ".thread__connector { stroke-dasharray: 14 8 !important; }",
        });
      }

      for (const id of SECTIONS) {
        if (only !== null && id !== only) continue;
        measured += 1;
        const section = page.locator(`#${id}`);
        /* A MISSING section is a failure, not a skip. `waitUntil: "load"` does not wait for React,
           so a dev recompile mid-run can leave `#id` matching nothing — and silently continuing
           made that indistinguishable from a section that was never there. Measured: four whole
           viewports produced no line at all and the gate still exited 0, reporting 28 cases where
           it should have reported 84. A gate that can measure a third of its surface and call it
           success is not a gate. */
        if ((await section.count()) === 0) {
          const label = `${id} ${viewport.name} ${state}`;
          console.log(
            `  MISSING ${label}: no element matches #${id} — not rendered`,
          );
          failures.push(label);
          continue;
        }
        /* Three things that are not this section's thread and would read as a second piece of ink:
           a NEIGHBOUR's thread, which legitimately runs past a section boundary and lands inside
           this section's box (a placement question, not a join); the Next dev-tools badge, which
           turns into a red pill the moment the dev server has anything to say; and the tuning
           panel's own chrome, which is `position: fixed` over the whole route.

           The panel is untracked scratch, so this hides it by a marker it opts into rather than by
           naming a file that may not exist — with no panel present the selector simply matches
           nothing. Without it the gate reports every section broken into the SAME 212 pieces at
           the SAME coordinates, which is the tell: a sweep whose answer is "everything is broken"
           is a bug in the sweep. */
        await page.evaluate((id) => {
          for (const thread of document.querySelectorAll(".thread")) {
            thread.style.visibility =
              thread.closest("section")?.id === id ? "" : "hidden";
          }
          for (const portal of document.querySelectorAll("nextjs-portal")) {
            portal.style.display = "none";
          }
          /* The panel's chrome is hidden by an injected STYLESHEET, not an inline style: the
             overlay is React-managed and re-renders when the section below is scrolled into view,
             which replaces the nodes and takes any inline `display` with them. A rule in the
             document outlives that. Measured: with the inline form the gate still reported 12
             broken invite renders; the same frames collapse to one run of ink under the rule. */
          const HIDE_ID = "thread-joins-hide-lab-chrome";
          if (document.getElementById(HIDE_ID) === null) {
            const style = document.createElement("style");
            style.id = HIDE_ID;
            style.textContent = "[data-lab-chrome]{display:none !important}";
            document.head.append(style);
          }
        }, id);
        await section.evaluate((node, at) => {
          node.scrollIntoView();
          /* `scrub` parks the section's own top at the window's top, which sits inside the hold
             band — the thread fully drawn and the animation live rather than removed. */
          if (at === "scrub") window.scrollBy(0, 1);
        }, state);
        await page.waitForTimeout(SETTLE);

        const shot = await section.screenshot();
        const { data, info } = await sharp(shot)
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        const found = components(data, info.width, info.height, info.channels);
        const label = `${id} ${viewport.name} ${state}`;
        const crossing = CROSSINGS.get(`${id} ${viewport.name}`);
        if (found.length === 1) {
          if (crossing !== undefined) mended.add(`${id} ${viewport.name}`);
          console.log(`  ok    ${label}: one run of ink (${found[0].size}px)`);
        } else if (crossing !== undefined) {
          crossed.add(`${id} ${viewport.name}`);
          console.log(`  known ${label}: ${found.length} pieces — ${crossing}`);
        } else {
          failures.push({ label, found });
          console.log(
            `  BREAK ${label}: ${found.length} pieces — ` +
              found
                .slice(0, 6)
                .map((piece) => `${piece.size}px@[${piece.box}]`)
                .join(" "),
          );
        }
      }
      await page.close();
    }
  }
} finally {
  await browser.close();
}

if (falsify) {
  const seen = failures.length;
  console.log(
    seen > 0
      ? `\nfalsify: the gate reported ${seen} broken renders against a deliberately cut thread — it can see a break.`
      : "\nfalsify: the gate saw nothing wrong with a deliberately cut thread. IT IS NOT A GATE.",
  );
  process.exit(seen > 0 ? 0 : 1);
}

console.log(
  failures.length === 0
    ? `\nevery section renders as one connected run of ink${
        crossed.size === 0
          ? ""
          : `, apart from ${crossed.size} recorded crossing(s)`
      }.`
    : `\n${failures.length} render(s) show a thread in pieces:\n${failures.map((f) => `  ${f.label}`).join("\n")}`,
);
/* The expected case count is asserted outright, so a whole viewport dropping out can never read as
   a pass: every section, at every viewport, in every state. */
const expected = SECTIONS.length * VIEWPORTS.length * STATES.length;
if (only === null && onlyViewport === null && measured !== expected) {
  console.log(
    `\nMEASURED ${measured} of ${expected} expected cases — the gate did not cover its surface.`,
  );
  process.exit(1);
}

/* A recorded crossing that no longer breaks is a stale exemption, and a stale exemption is a hole
   in the gate. Tuning one away deletes its entry; it does not leave it here. */
if (only === null && onlyViewport === null && !falsify) {
  const stale = [...CROSSINGS.keys()].filter(
    (key) => mended.has(key) && !crossed.has(key),
  );
  if (stale.length > 0) {
    console.log(
      `\nRECORDED CROSSINGS THAT NO LONGER BREAK — remove them from CROSSINGS:\n${stale
        .map((key) => `  ${key}`)
        .join("\n")}`,
    );
    process.exit(1);
  }
}
process.exit(failures.length === 0 ? 0 : 1);
