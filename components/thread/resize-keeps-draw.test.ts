import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join } from "node:path";
import test from "node:test";

/* THE THREAD MUST NOT UN-DRAW ITSELF WHEN THE VIEWPORT'S HEIGHT CHANGES — the owner reported three
   phone symptoms that were one bug: glitches, the re-trace running where no thread was drawn, and
   the thread DISAPPEARING when they scrolled back up. All three came from `window.resize` running
   the full re-measure, which discarded the draw ratchet. A mobile URL bar collapses on scroll-down
   and expands on scroll-up, and each is a height-only resize fired DURING the scroll — so on a phone
   this fired on every direction change, and the ratchet is the only thing holding the owner's "and
   then stay drawn".

   THE GESTURE IS THE WHOLE TEST, AND IT IS NOT ENOUGH TO SIT PART-WAY DOWN. Discarding the ratchet is
   only VISIBLE where the held peak exceeds what the current scroll position would draw on its own —
   which is precisely a reader who has scrolled DOWN and come back UP. A first version of this test
   scrolled to 60% and resized there, and it PASSED against the pre-fix code: at a position the reader
   has just reached, the fresh measurement is the peak, so dropping the peak changes nothing. So this
   descends deep, returns to a shallower position where the ratchet is the only thing holding the
   thread, and resizes there. The two ends are avoided for the reasons `head-retires.test.ts` gives:
   at scroll 0 there is nothing drawn to lose, and at the page's end the thread is complete, so a
   discarded ratchet re-seeds to complete and the regression is invisible.

   THE SCROLL POSITION IS A FRACTION, NEVER A PIXEL VALUE. The page's height moves with the content
   (celebrations alone grew ~1,000px at `tall` in one round, and the first two rituals' photographs
   are temporary), so an absolute figure would rot.

   This runs the BUILT export rather than the model: the defect is in the render layer's listener
   wiring, which no unit test reaches — `pageDrawnLength` and `openingFloor` are local to
   `page-thread.tsx`, and exporting them to reach the arithmetic from a unit test would only re-check
   a formula, not the dispatch that was wrong. The harness shape is copied from
   `head-retires.test.ts`, which exports nothing. */

const TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".woff2": "font/woff2",
};

function serveExport(): Promise<{ server: Server; port: number }> {
  const server = createServer((request, response) => {
    const path = decodeURIComponent((request.url ?? "/").split("?")[0]);
    const file = join("out", path.endsWith("/") ? `${path}index.html` : path);
    if (!existsSync(file)) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {
      "content-type": TYPES[extname(file)] ?? "application/octet-stream",
    });
    response.end(readFileSync(file));
  });
  return new Promise((resolve) => {
    server.listen(0, () => {
      const address = server.address();
      resolve({
        server,
        port: typeof address === "object" && address ? address.port : 0,
      });
    });
  });
}

/* The page carries TWO `.pageRoot` svgs — the no-JS fallback, hidden once JS takes over, and the live
   one — so every read walks up to its own `<svg>` and skips a hidden tree. The fallback's paths carry
   no inline dash either, which the `Number.isFinite` guard also excludes; both filters are kept,
   because reading the wrong root is a mistake this project has already made.

   A piece's drawn length is its dash period minus its offset. The absolute figure is meaningless (the
   period carries `DASH_EPSILON` and the units are arc length), and that is fine: this test only ever
   compares the same quantity before and after a resize. The head is read as its displayed GROUP, not
   per path — hiding the group is how the head retires, and counting paths reads a hidden group as
   lit. */
/* `main`'s own height against every live thread root's viewBox height. The thread's `<svg>` is sized
   and viewBoxed from `main`'s measured box, so these must track each other or the line is drawn at
   the wrong scale over the content it traces. */
const BOXES = `(() => {
  const main = document.querySelector("main");
  const roots = Array.from(document.querySelectorAll("[data-thread-svg]"))
    .filter((s) => s.style.display !== "none");
  return {
    mainHeight: Math.round(main.getBoundingClientRect().height),
    roots: roots.map((s) => s.getAttribute("viewBox")),
  };
})()`;

/* `total` is the THREAD's own total arc length (the sum of every piece's dash period), which is the
   quantity the ratchet's peak is expressed in and the one `rebase` scales between. The page's
   `scrollHeight` is NOT interchangeable with it — an earlier version of this test divided by that and
   read 128% drawn. The proportion matters because an ABSOLUTE comparison carries free slack: the
   thread lengthens when the page does, so the rebase makes the absolute figure larger either way and
   a mutation losing a few percent of the peak would slip through.

   NOTE FOR ANYONE EDITING THE STRING BELOW: it is a template literal, so a BACKTICK inside it — even
   inside a comment — closes it, and the error points at the next line rather than at the backtick.
   Explanations belong out here. */
const READ = `(() => {
  const visible = (el) => {
    for (let node = el; node !== null; node = node.parentElement) {
      if (node.style && node.style.display === "none") return false;
    }
    return true;
  };
  const pieces = Array.from(document.querySelectorAll("path[data-thread-piece]")).filter(visible);
  let drawn = 0;
  let total = 0;
  let measured = 0;
  for (const p of pieces) {
    const period = Number.parseFloat(p.style.strokeDasharray);
    const offset = Number.parseFloat(p.style.strokeDashoffset);
    if (!Number.isFinite(period) || !Number.isFinite(offset)) continue;
    measured += 1;
    drawn += Math.max(0, period - offset);
    total += period;
  }
  const headShown = Array.from(document.querySelectorAll("[data-thread-head]"))
    .filter(visible)
    .reduce((total, g) => total + Array.from(g.querySelectorAll("path")).filter(visible).length, 0);
  return { drawn, total, measured, pieces: pieces.length, headShown };
})()`;

type Reading = {
  drawn: number;
  measured: number;
  pieces: number;
  headShown: number;
  total: number;
};

/* A URL-bar expand is a height-only change; 852 -> 912 is the same shape. The width is held
   identical on purpose — a width change is a genuine layout change and SHOULD re-measure. */
const PHONE = { width: 393, height: 852 };
const TALLER = { width: 393, height: 912 };

/* Past `--thread-catchup` (0.4s) with room to spare, so every read measures where the draw SETTLES
   rather than racing the follower. */
const SETTLE = 1200;

test("a height-only resize does not un-draw the thread", async (t) => {
  if (!existsSync("out/index.html")) {
    t.skip("no static export: run `npm run build` first");
    return;
  }
  /* Not wrapped: with an export present, a missing browser must fail rather than quietly skip, or
     the only guard this behaviour has would disappear without a sound. */
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ channel: "chromium" });
  const { server, port } = await serveExport();
  try {
    const context = await browser.newContext({
      viewport: PHONE,
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.goto(`http://localhost:${port}/`, { waitUntil: "load" });
    /* The opening sequence ends at `OPENING_DRAW_DELAY` and its own draw runs beyond it. */
    await page.waitForTimeout(3600);

    /* Fractions of the page, never pixel values. Descend in steps so the head is observed WHILE
       drawing — without that, an unchanged reading would prove nothing if the thread never drew at
       all, the vacuous shape this project has shipped once already. */
    let headSeenMidDraw = 0;
    for (const at of [0.2, 0.4, 0.6, 0.78, 0.85]) {
      await page.evaluate(
        `window.scrollTo(0, (document.documentElement.scrollHeight - window.innerHeight) * ${at})`,
      );
      await page.waitForTimeout(SETTLE);
      headSeenMidDraw = Math.max(
        headSeenMidDraw,
        ((await page.evaluate(READ)) as Reading).headShown,
      );
    }
    assert.ok(
      headSeenMidDraw > 0,
      "the head never painted on the way down, so an unchanged reading after the resize proves nothing",
    );
    const deep = (await page.evaluate(READ)) as Reading;

    /* BACK UP. From here the ratchet is the only thing keeping the thread drawn: the scroll position
       alone would draw far less. That is the state the owner's URL bar lands in. */
    await page.evaluate(
      "window.scrollTo(0, (document.documentElement.scrollHeight - window.innerHeight) * 0.45)",
    );
    await page.waitForTimeout(SETTLE);

    const before = (await page.evaluate(READ)) as Reading;
    assert.ok(
      before.measured > 0,
      `no piece carried a dash (${before.pieces} pieces visible) — the reader is broken, not the thread`,
    );
    assert.ok(before.drawn > 0, "nothing was drawn at 45% of the page");
    assert.ok(
      before.drawn >= deep.drawn - 1,
      `the ratchet already failed before any resize: ${deep.drawn.toFixed(1)} -> ${before.drawn.toFixed(1)} on the way back up`,
    );

    await page.setViewportSize(TALLER);
    await page.waitForTimeout(600); // outlast the 150ms layout debounce
    await page.waitForTimeout(SETTLE);

    const after = (await page.evaluate(READ)) as Reading;
    /* Asserted as a PROPORTION of the thread's own arc length, not as an absolute dash sum: the
       thread lengthens with the page, so the rebase makes the absolute figure larger either way and
       an absolute assertion would carry several percent of free slack. The 0.5% tolerance absorbs the
       rebase's float rounding. */
    const beforeShare = before.drawn / before.total;
    const afterShare = after.drawn / after.total;
    assert.ok(
      afterShare >= beforeShare - 0.005,
      `the thread un-drew: ${(beforeShare * 100).toFixed(1)}% of the thread drawn -> ${(afterShare * 100).toFixed(1)}% after a height-only resize ` +
        `(${before.drawn.toFixed(1)} of ${before.total} -> ${after.drawn.toFixed(1)} of ${after.total})`,
    );
    await context.close();
  } finally {
    await browser.close();
    server.close();
  }
});

/* A reader who has not scrolled at all is the case most likely to be missed: the cheap path takes the
   same `Math.max(..., openingFloor(...))` that `measureLayout` does, so a URL bar moving during or
   after the opening sequence cannot leave them looking at no thread. Unreachable from a unit test —
   `openingFloor` is local to `page-thread.tsx` — so it is asserted here.
   (An earlier version of this said the SCROLL path takes that floor. It does not: `commitScrolled`
   passes `pageDrawnLength` alone and relies on the ratchet's peak to hold the opening draw. The two
   measure paths are the only ones that re-derive the floor.)

   HONEST LIMIT, measured 2026-10-07: this test is NOT independently mutation-proven. Dropping
   `openingFloor` from `refreshWindow` and rebuilding leaves it PASSING, because the ratchet now
   REBASES rather than resets, so the peak already carries the opening draw's length and the floor is
   redundant at the 393x852 -> 393x912 pair. The floor is kept because it mirrors the scroll path
   exactly and because the reachable case is a resize where the invite's share of the total grows
   faster than the rest (the hero is viewport-height, the content sections are not) — which this pair
   evidently does not reach. So read this as a guard on the cheap path not erasing the opening draw by
   ANY mechanism, not as proof that the floor is what holds it. */
test("a height-only resize at the top does not erase what the opening draw drew", async (t) => {
  if (!existsSync("out/index.html")) {
    t.skip("no static export: run `npm run build` first");
    return;
  }
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ channel: "chromium" });
  const { server, port } = await serveExport();
  try {
    const context = await browser.newContext({
      viewport: PHONE,
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.goto(`http://localhost:${port}/`, { waitUntil: "load" });
    await page.waitForTimeout(3600); // the opening sequence plus its draw

    const before = (await page.evaluate(READ)) as Reading;
    assert.ok(
      before.drawn > 0,
      "the opening draw left nothing drawn — check the sequence completed",
    );

    await page.setViewportSize(TALLER);
    await page.waitForTimeout(600);
    await page.waitForTimeout(SETTLE);

    const after = (await page.evaluate(READ)) as Reading;
    assert.ok(
      after.drawn >= before.drawn - 1,
      `the opening draw was erased: ${before.drawn.toFixed(1)} -> ${after.drawn.toFixed(1)} at scroll 0`,
    );
    await context.close();
  } finally {
    await browser.close();
    server.close();
  }
});

/* THE SPLIT MUST BE GATED ON WHETHER THE LAYOUT MOVED, NOT ON WHETHER THE WIDTH DID — and this test
   exists because the first version of the fix got that wrong, in a way that only showed on the page.

   A viewport-height change is the cheap path's whole reason for existing, because that is what a
   mobile URL bar is. But a height change is NOT always layout-neutral: the sections are sized in
   `100svh`, which is stable when a phone's toolbar hides and is NOT stable when the window itself
   changes height — a desktop F11, a window drag, an auto-hiding taskbar, or any harness calling
   `setViewportSize`. Measured on the built export at 393x852 -> 393x912: `main` reflows
   **8632 -> 9052px**, 420px taller.

   The thread's `<svg>` takes its height and its viewBox from `main`'s measured box, and the cheap
   path deliberately re-measures nothing — so gating it on width alone left the svg at
   `viewBox="0 0 393 8640"` over 9052px of content, drawing the whole thread at ~95% scale with its
   tail some 412px above the page's end, and NOTHING re-measures until a width change or a font load.
   A dash-length assertion cannot see that: the drawn LENGTH is correct, it is the box that is wrong.
   So this asserts the box. */
test("a resize that reflows the page re-measures rather than taking the cheap path", async (t) => {
  if (!existsSync("out/index.html")) {
    t.skip("no static export: run `npm run build` first");
    return;
  }
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ channel: "chromium" });
  const { server, port } = await serveExport();
  try {
    const context = await browser.newContext({
      viewport: PHONE,
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.goto(`http://localhost:${port}/`, { waitUntil: "load" });
    await page.waitForTimeout(3600);

    const before = (await page.evaluate(BOXES)) as {
      mainHeight: number;
      roots: string[];
    };
    assert.ok(before.roots.length > 0, "no live thread root was found");

    await page.setViewportSize(TALLER);
    /* Past the 150ms layout debounce with room to spare — this path is deliberately the SLOW one. */
    await page.waitForTimeout(600);
    await page.waitForTimeout(SETTLE);

    const after = (await page.evaluate(BOXES)) as {
      mainHeight: number;
      roots: string[];
    };
    /* If the page did NOT reflow there is nothing to assert, and saying so beats passing vacuously:
       on a real handset `100svh` holds and this is the state the cheap path is for. */
    assert.notEqual(
      after.mainHeight,
      before.mainHeight,
      `main did not reflow (${before.mainHeight}px), so this test asserted nothing — a harness viewport change is expected to move 100svh`,
    );

    const pageRoot = after.roots.find((v) => v?.startsWith("0 0 "));
    assert.ok(
      pageRoot,
      `no page-spanning viewBox among ${JSON.stringify(after.roots)}`,
    );
    const boxedHeight = Number.parseFloat(pageRoot.split(" ")[3]);
    assert.ok(
      Math.abs(boxedHeight - after.mainHeight) <= 16,
      `the thread's viewBox is stale: ${boxedHeight.toFixed(0)} against main's ${after.mainHeight} after the page reflowed by ${after.mainHeight - before.mainHeight}px`,
    );
    /* Every other live root must have moved too — the weave's box is card-relative, so a stale one
       is the same defect one level down. */
    assert.ok(
      after.roots.some((v, i) => v !== before.roots[i]),
      "no live thread root's viewBox changed at all, so none was re-measured",
    );
    await context.close();
  } finally {
    await browser.close();
    server.close();
  }
});
