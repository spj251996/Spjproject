#!/usr/bin/env node
/* THE ZERO-LAYOUT-IMPACT GATE. `thread.module.css`'s `.pageWrapper` documents a contract — the
 * span both `PageThread` and `CardThread` mount as their root takes no space in flow and does not
 * push its host's own layout apart. That was true and verified for a flex-column host and silently
 * false for a CSS-Grid one: an in-flow box is still a grid item at `height: 0`, so `CardThread`'s
 * two copies (it drew two then; it draws one now) were auto-placing into Wishes' `>=64rem` landscape grid, growing it past its four
 * EXPLICIT rows and starving `.figureCol`'s `grid-row: 1 / -1` (which spans the explicit grid only,
 * per spec) down to two of them. `.figureCol` measured 160px against the stack's own 384px, and the
 * couple illustration overflowed ~87px above and below it — on the real page, at 1536x695, where
 * every other gate (211 unit tests, `tsc`, lint, a green build) stayed green (`session.md`,
 * `.superpowers/sdd/wishes-figure-regression.md`, 2026-09-27).
 *
 * WHY A RENDER AND NOT A UNIT TEST. The defect is an emergent interaction between two files
 * (`thread.module.css`'s positioning and `app/wishes.module.css`'s grid) that no test scoped to
 * either file alone can see — a unit test on `thread-line.ts`'s pure geometry never mounts inside
 * `wishes`' real grid, and a Tailwind/CSS-module compile probe never lays out a real box. Per this
 * project's own standing lesson (`lessons.md`, 2026-09-25): "counting a mount by COLOUR rather than
 * geometry has already passed here while the owner saw nothing" — this asserts the RECT.
 *
 * WHAT IT ASSERTS. At a grid-triggering viewport (`>=64rem` landscape — the only place Wishes'
 * `.stack` becomes a grid), `.figureCol`'s rendered height must equal `.wishes-stack`'s own height,
 * within antialiasing tolerance. This is the general shape of check `.pageWrapper`'s contract
 * needs: for anything documented as "takes no layout space," assert a sibling/ancestor's measured
 * rect is unchanged by its presence — not just that it compiles or that types check.
 *
 * SELECTORS, and why neither touches a restricted file: `.wishes-stack` is already a plain (non-
 * module) class on the stack div in `app/_sections/wishes.tsx`, so no source file needs editing to
 * reach it.
 * `.figureCol` is a CSS-module class with no stable literal name — it is found instead as the
 * element immediately BEFORE `[data-thread-card]`, the call site's own fixed DOM relationship
 * (`app/_sections/wishes.tsx`: `CardThread` is the next sibling of `wishesStyles.figureCol`).
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
/* The thread is not on the published page -- `/` carries none since the lab split, so this gate points
 * at the lab route (DESIGN.md -> Technical Conventions -> Variant Routes). Against the DEV server the
 * extensionless path routes correctly; a gate reading the static export needs `.html`, because an
 * export emits a dynamic route as `out/thread/<variant>.html`. */
const LAB_ROUTE = "/thread/current";

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
let exitCode = 1;
try {
  const page = await browser.newPage({
    viewport: { width: wide.box.width, height: wide.box.height },
    deviceScaleFactor: 1,
  });
  page.setDefaultTimeout(NAV);
  await page.goto(`${ORIGIN}${LAB_ROUTE}`, { waitUntil: "load", timeout: NAV });
  await page
    .evaluate(() => document.fonts.ready)
    .catch(() =>
      console.warn("  fonts did not settle; geometry is unaffected"),
    );

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
    console.log(`  BREAK: ${result.error}`);
    exitCode = 1;
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
  console.log(
    exitCode !== 0
      ? "\nfalsify: the gate reported a break against a deliberately reintroduced defect -- it can see it."
      : "\nfalsify: the gate saw nothing wrong with a deliberately reintroduced defect. IT IS NOT A GATE.",
  );
  process.exit(exitCode !== 0 ? 0 : 1);
}

process.exit(exitCode);
