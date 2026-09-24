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
 * CAPS: a fixed 7 sections x 4 viewports x 2 states, navigation 20s, fonts 5s best-effort, one
 * fixed 350ms settle after each park. No convergence loops, no unbounded waits.
 *
 * USAGE:
 *   node scripts/check-thread-joins.mjs
 *   node scripts/check-thread-joins.mjs --section=family --viewport=phone
 *   node scripts/check-thread-joins.mjs --falsify     # prove the gate can see a break
 */

import { chromium } from "playwright";
import sharp from "sharp";

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

const VIEWPORTS = [
  { name: "phone", width: 390, height: 844, dpr: 2 },
  { name: "tablet", width: 768, height: 1024, dpr: 1 },
  { name: "laptop", width: 1280, height: 720, dpr: 1 },
  { name: "desktop", width: 1920, height: 900, dpr: 1 },
];

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
const failures = [];
try {
  for (const viewport of VIEWPORTS) {
    if (onlyViewport !== null && viewport.name !== onlyViewport) continue;
    for (const state of ["rest", "scrub"]) {
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
        const section = page.locator(`#${id}`);
        if ((await section.count()) === 0) continue;
        /* Two things that are not this section's thread and would read as a second piece of ink:
           a NEIGHBOUR's thread, which legitimately runs past a section boundary and lands inside
           this section's box (a placement question, not a join), and the Next dev-tools badge,
           which turns into a red pill the moment the dev server has anything to say. */
        await page.evaluate((id) => {
          for (const thread of document.querySelectorAll(".thread")) {
            thread.style.visibility =
              thread.closest("section")?.id === id ? "" : "hidden";
          }
          for (const portal of document.querySelectorAll("nextjs-portal")) {
            portal.style.display = "none";
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
        if (found.length === 1) {
          console.log(`  ok    ${label}: one run of ink (${found[0].size}px)`);
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
    ? "\nevery section renders as one connected run of ink."
    : `\n${failures.length} render(s) show a thread in pieces:\n${failures.map((f) => `  ${f.label}`).join("\n")}`,
);
process.exit(failures.length === 0 ? 0 : 1);
