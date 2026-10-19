#!/usr/bin/env node
/* THE ZERO-LAYOUT-IMPACT GATE. The span `PageThread` and `CardThread` mount as their root must take
 * no space in flow. In a CSS Grid host an in-flow box is still a grid item at `height: 0`, so a card
 * thread in flow inside Wishes' `>=64rem` landscape grid grows it past its explicit rows and starves
 * `.figureCol`'s `grid-row: 1 / -1`. No unit test can see it (it is an interaction between
 * `thread.module.css` and `app/wishes.module.css`), so this asserts the rendered RECT: at `>=64rem`
 * landscape, `.figureCol`'s height equals `.wishes-stack`'s height within antialiasing tolerance.
 * `.figureCol` is a CSS-module class with no stable name, so it is found as the element immediately
 * before `[data-thread-card]`.
 *
 * ENGINE PIN (mandatory): `chromium.launch({ channel: "chromium" })` — the default launch reaches
 * for Chromium's old `headless_shell`, whose rendering differs from every real browser.
 *
 * DEV SERVER: never started, stopped or restarted here — :3000 is the owner's own review surface.
 *
 * USAGE:
 *   node scripts/check-thread-layout-impact.mjs
 *   node scripts/check-thread-layout-impact.mjs --falsify   # prove the gate can see the defect
 */

import { chromium } from "playwright";
import { THREAD_BANDS } from "../components/thread/thread-bands.ts";

const ORIGIN = "http://localhost:3000";
/* The thread is not on the published page -- `/` carries none, so this gate points
 * at the lab route (DESIGN.md -> Technical Conventions -> Variant Routes). Against the DEV server the
 * extensionless path routes correctly; a gate reading the static export needs `.html`, because an
 * export emits the static route as `out/thread.html`. */
const LAB_ROUTE = "/thread";

const NAV = 20000;
const SETTLE = 350;
const TOLERANCE = 1;

const falsify = process.argv.includes("--falsify");

/* The `wide` band's own nominal box — 1536x695, `>=64rem` and landscape — is the one viewport where
 * Wishes' `.stack` engages its grid layout at all; every other band renders it as a flex column,
 * where `.pageWrapper` was never broken and this check would assert nothing. */
const wide = THREAD_BANDS.find((band) => band.id === "wide");
if (wide === undefined) {
  console.error("check-thread-layout-impact: no 'wide' band in THREAD_BANDS.");
  process.exit(2);
}

const reachable = await fetch(ORIGIN, { signal: AbortSignal.timeout(NAV) })
  .then((response) => response.ok)
  .catch(() => false);
if (!reachable) {
  console.error(
    `check-thread-layout-impact: nothing answers on ${ORIGIN}. Start the dev server yourself — this script never does.`,
  );
  process.exit(2);
}

const browser = await chromium.launch({ channel: "chromium" });
/* 1 is a detected break, 2 a measurement that never ran -- kept apart so `--falsify` cannot read an
   errored render as the gate seeing its defect. */
let exitCode = 1;
try {
  const page = await browser.newPage({
    viewport: { width: wide.box.width, height: wide.box.height },
    deviceScaleFactor: 1,
  });
  page.setDefaultTimeout(NAV);
  await page.goto(`${ORIGIN}${LAB_ROUTE}`, { waitUntil: "load", timeout: NAV });
  await page
    .waitForFunction(() => document.fonts.status === "loaded", null, {
      timeout: 5000,
    })
    .catch(() => console.log("fonts did not settle in 5s, continuing"));

  if (falsify) {
    /* Reproduce the exact defect this gate exists to catch: put the card thread's wrapper back in flow,
     * which is what `relative` did before the fix. A gate that cannot see this cannot see the
     * regression it is here for, and a run that passes under `--falsify` is the gate failing. */
    await page.addStyleTag({
      content: "[data-thread-card] { position: relative !important; }",
    });
  }

  await page.locator("#wishes").evaluate((node) => node.scrollIntoView());
  await page.waitForTimeout(SETTLE);

  const result = await page.evaluate(() => {
    const stack = document.querySelector(".wishes-stack");
    const cardThread = document.querySelector("[data-thread-card]");
    const figureCol = cardThread?.previousElementSibling ?? null;
    if (stack === null || cardThread === null || figureCol === null) {
      return { error: "one or more Wishes elements did not render" };
    }
    return {
      stackHeight: stack.getBoundingClientRect().height,
      figureColHeight: figureCol.getBoundingClientRect().height,
      cardPathD: cardThread.querySelector("path")?.getAttribute("d") ?? "",
    };
  });

  if ("error" in result) {
    console.log(`  ERROR: ${result.error}`);
    exitCode = 2;
  } else {
    const { stackHeight, figureColHeight, cardPathD } = result;
    const delta = Math.abs(stackHeight - figureColHeight);
    const geometryOk = delta <= TOLERANCE;
    const cardOk = cardPathD.length > 0;

    console.log(
      `  stack height ${stackHeight.toFixed(2)}px, figureCol height ${figureColHeight.toFixed(2)}px, delta ${delta.toFixed(2)}px`,
    );
    console.log(
      geometryOk
        ? "  ok    figureCol spans the stack's full height"
        : "  BREAK figureCol does not span the stack's full height -- .pageWrapper is back in flow inside Wishes' grid",
    );
    console.log(
      cardOk
        ? "  ok    the card thread renders a non-empty path"
        : "  BREAK the card thread rendered no path",
    );

    exitCode = geometryOk && cardOk ? 0 : 1;
  }
} finally {
  await browser.close();
}

if (falsify) {
  if (exitCode === 2) {
    console.log("\nfalsify inconclusive: measurement errored");
    process.exit(1);
  }
  console.log(
    exitCode === 1
      ? "\nfalsify: the gate reported a break against a deliberately reintroduced defect -- it can see it."
      : "\nfalsify: the gate saw nothing wrong with a deliberately reintroduced defect. IT IS NOT A GATE.",
  );
  process.exit(exitCode === 1 ? 0 : 1);
}

process.exit(exitCode);
