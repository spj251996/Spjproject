import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join } from "node:path";
import test from "node:test";
import { labExport } from "../../scripts/lib/built-export.ts";

/* The draw's cases measure without the sway, which ships on and keeps a frame loop of its own and re-shapes
   every path: `data-thread-sway="off"` on `<html>`, set the moment the element exists, turns it off for them.
   The sway's own lifecycle cases leave it on. */
const SWAY_OFF = `(() => {
  const off = () => {
    if (!document.documentElement) return false;
    document.documentElement.dataset.threadSway = "off";
    return true;
  };
  if (!off()) new MutationObserver((_, watcher) => off() && watcher.disconnect()).observe(document, { childList: true });
})()`;

/* The thread is not on the published page -- `/` carries none since the lab split, so a gate pointed
   there measures a thread-free page and reads as a product defect (DESIGN.md -> Technical Conventions
   -> Variant Routes). The export server serves literal paths, and a static route emits
   `out/thread.html`, so the URL carries `.html`. */
const LAB_ROUTE = "/thread.html";

/* What reduced motion, idleness and a hidden tab do to the thread can only be shown on a real page, run
   against the static export as the built-artifact tests are, and skipped, saying so, without one; a browser
   that will not launch fails it. */

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

interface Reading {
  pieces: number;
  undashed: number;
}

const READ = `(() => {
  const pieces = Array.from(document.querySelectorAll("path[data-thread-piece]"));
  return {
    pieces: pieces.length,
    undashed: pieces.filter((p) => p.style.strokeDasharray === "").length,
  };
})()`;

test("reduced motion leaves the thread complete and undashed at the top and the bottom, and a change to reduce completes a drawing thread", async (t) => {
  if (!labExport(t)) return;
  /* Not wrapped: with an export present, a missing browser or a launch error must fail this test,
     not skip it, or the only protection reduced motion has would disappear without a sound. */
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ channel: "chromium" });
  const { server, port } = await serveExport();
  try {
    const open = async (reducedMotion: "reduce" | "no-preference") => {
      const context = await browser.newContext({
        viewport: { width: 393, height: 700 },
        reducedMotion,
      });
      const page = await context.newPage();
      await page.addInitScript(SWAY_OFF);
      await page.goto(`http://localhost:${port}${LAB_ROUTE}`, {
        waitUntil: "load",
      });
      return page;
    };
    const [reduced, moving] = await Promise.all([
      open("reduce"),
      open("no-preference"),
    ]);
    await moving.waitForSelector("[data-thread-opened]", {
      state: "attached",
      timeout: 15000,
    });
    await reduced.waitForTimeout(5000);
    const reducedAtTop = (await reduced.evaluate(READ)) as Reading;
    await reduced.evaluate(
      "window.scrollTo(0, document.documentElement.scrollHeight)",
    );
    await reduced.waitForTimeout(1500);
    const reducedAtBottom = (await reduced.evaluate(READ)) as Reading;
    const movingReading = (await moving.evaluate(READ)) as Reading;
    await moving.emulateMedia({ reducedMotion: "reduce" });
    await moving.waitForTimeout(1500);
    const switchedToReduce = (await moving.evaluate(READ)) as Reading;

    for (const [where, reading] of [
      ["at the top", reducedAtTop],
      ["at the bottom", reducedAtBottom],
    ] as const) {
      assert.ok(reading.pieces > 0, "the thread is on the page");
      assert.equal(
        reading.undashed,
        reading.pieces,
        `every piece is complete ${where}`,
      );
    }
    assert.ok(
      movingReading.undashed < movingReading.pieces,
      "with motion the thread is still being drawn, so some piece is dashed",
    );
    assert.equal(
      switchedToReduce.undashed,
      switchedToReduce.pieces,
      "a change to reduce leaves the thread complete",
    );
  } finally {
    await browser.close();
    server.close();
  }
});

interface Dashes {
  pieces: number;
  dashed: number;
  midDraw: number;
}

const DASHES = `(() => {
  const pieces = Array.from(document.querySelectorAll("path[data-thread-piece]"));
  return {
    pieces: pieces.length,
    dashed: pieces.filter((p) => p.style.strokeDasharray !== "" || p.style.strokeDashoffset !== "").length,
    midDraw: pieces.filter((p) => {
      const offset = parseFloat(p.style.strokeDashoffset);
      return offset > 0 && offset < parseFloat(p.style.strokeDasharray);
    }).length,
  };
})()`;

/* The two draws that run on their own clock rather than on a scroll frame: the opening's timed draw
   and the catch-up follower easing toward a fling's target. Both paint dashes frame by frame, so a
   change to reduce that lands while one is in flight is cleared by the re-measure and then re-dashed
   by the draw's next frame unless the draw is stopped with it. Each case switches while a piece is
   visibly mid-draw, then waits out the draw's whole remaining time before reading. */
test("a change to reduced motion during the opening draw or a catch-up leaves no piece dashed", async (t) => {
  if (!labExport(t)) return;
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ channel: "chromium" });
  const { server, port } = await serveExport();
  try {
    const open = async () => {
      const page = await (
        await browser.newContext({ viewport: { width: 393, height: 700 } })
      ).newPage();
      await page.addInitScript(SWAY_OFF);
      await page.goto(`http://localhost:${port}${LAB_ROUTE}`, {
        waitUntil: "load",
      });
      return page;
    };
    const switchToReduce = async (page: Awaited<ReturnType<typeof open>>) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      assert.equal(
        await page.evaluate(
          "matchMedia('(prefers-reduced-motion: reduce)').matches",
        ),
        true,
        "the media query flipped",
      );
    };

    const opening = await open();
    await opening.waitForFunction(
      `(${DASHES}).midDraw > 0 && performance.now() > 2000`,
      null,
      { timeout: 10000, polling: 10 },
    );
    await switchToReduce(opening);
    /* The opening draw lasts 1200ms from its first frame; this outlasts all of it. */
    await opening.waitForTimeout(2000);
    const afterOpening = (await opening.evaluate(DASHES)) as Dashes;
    assert.ok(afterOpening.pieces > 0, "the thread is on the page");
    assert.equal(
      afterOpening.dashed,
      0,
      "no piece is re-dashed by the opening draw after the change",
    );

    const catchUp = await open();
    /* The opening draw has ended, so nothing but the follower is drawing. */
    await catchUp.waitForSelector("[data-thread-opened]", {
      state: "attached",
      timeout: 15000,
    });
    const inFlight = (await catchUp.evaluate(
      `new Promise((resolve) => {
        window.scrollTo(0, document.documentElement.scrollHeight);
        requestAnimationFrame(() => requestAnimationFrame(() => resolve((${DASHES}).midDraw)));
      })`,
    )) as number;
    assert.ok(inFlight > 0, "the follower is mid-draw when the change lands");
    await switchToReduce(catchUp);
    /* `--thread-catchup` is 0.4s; this outlasts it several times over. */
    await catchUp.waitForTimeout(1500);
    const afterCatchUp = (await catchUp.evaluate(DASHES)) as Dashes;
    assert.equal(
      afterCatchUp.dashed,
      0,
      "no piece, on the page thread or the card's, is re-dashed by a follower after the change",
    );
  } finally {
    await browser.close();
    server.close();
  }
});

/* The sway's lifecycle (DESIGN.md -> Thread -> The sway): it moves while the page is touched and stops once the
   page has gone `--thread-idle` untouched, with no loop minimum; a scroll or interaction starts it again, and a
   tab coming back is not an interaction. `--thread-idle` is shortened so the stop fits inside a test: it is read
   by name from the stylesheet, which is what is being relied on, and a key makes the page read it again.
   `document.visibilityState` is overridden to drive a hidden tab, since a headless page is always visible. */

const SHORT_IDLE = ":root{--thread-idle:1500ms}";

const HIDDEN_TAB = `(() => {
  let hidden = false;
  Object.defineProperty(document, "visibilityState", { get: () => (hidden ? "hidden" : "visible"), configurable: true });
  window.__setHidden = (value) => { hidden = value; document.dispatchEvent(new Event("visibilitychange")); };
})()`;

/* Whether any of the trunk's shown pieces changes shape over `ms`: the sway is the only thing that re-shapes a
   piece while the page is still. */
const SWAYING = (ms: number) => `(async () => {
  const svg = [...document.querySelectorAll("[data-thread-svg]")].sort((a, b) => b.querySelectorAll("path[data-thread-piece]").length - a.querySelectorAll("path[data-thread-piece]").length)[0];
  const shown = [...svg.querySelectorAll("path[data-thread-piece]")].filter((p) => p.style.visibility !== "hidden");
  const before = shown.map((p) => p.getAttribute("d"));
  await new Promise((resolve) => setTimeout(resolve, ${ms}));
  return shown.some((p, i) => p.getAttribute("d") !== before[i]);
})()`;

const RETRACE_ELEMENTS =
  "document.querySelectorAll('[data-thread-retrace-group], [data-thread-retrace-glow]').length";

test("no re-trace is ever painted: after the opening, at rest, scrolled back up a finished thread, and in the card", async (t) => {
  if (!labExport(t)) return;
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ channel: "chromium" });
  const { server, port } = await serveExport();
  try {
    const context = await browser.newContext({
      viewport: { width: 393, height: 700 },
    });
    const page = await context.newPage();
    await page.addInitScript(SWAY_OFF);
    await page.goto(`http://localhost:${port}${LAB_ROUTE}`, {
      waitUntil: "load",
    });
    await page.waitForSelector("[data-thread-opened]", {
      state: "attached",
      timeout: 15000,
    });
    await page.waitForTimeout(3000);
    assert.equal(
      await page.evaluate(RETRACE_ELEMENTS),
      0,
      "nothing lights the line at rest after the opening",
    );
    await page.evaluate(
      "window.scrollTo(0, document.documentElement.scrollHeight)",
    );
    await page.waitForTimeout(2500);
    await page.evaluate(
      "window.scrollTo(0, document.documentElement.scrollHeight * 0.3)",
    );
    await page.waitForTimeout(3000);
    assert.equal(
      await page.evaluate(RETRACE_ELEMENTS),
      0,
      "nothing lights a finished line scrolled back up, the card thread's included",
    );
  } finally {
    await browser.close();
    server.close();
  }
});

test("the sway stops once the page goes idle, with no loop minimum, and a scroll starts it again", async (t) => {
  if (!labExport(t)) return;
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ channel: "chromium" });
  const { server, port } = await serveExport();
  try {
    const context = await browser.newContext({
      viewport: { width: 393, height: 700 },
    });
    const page = await context.newPage();
    await page.goto(`http://localhost:${port}${LAB_ROUTE}`, {
      waitUntil: "load",
    });
    await page.waitForSelector("[data-thread-opened]", {
      state: "attached",
      timeout: 15000,
    });
    await page.addStyleTag({ content: SHORT_IDLE });
    await page.keyboard.press("Shift");
    assert.equal(
      await page.evaluate(SWAYING(500)),
      true,
      "the line sways while the page is touched",
    );
    await page.waitForTimeout(2500);
    assert.equal(
      await page.evaluate(SWAYING(800)),
      false,
      "once idle the line is still, with nothing holding it moving for a number of loops",
    );
    await page.evaluate("window.scrollBy(0, 40)");
    await page.waitForTimeout(200);
    assert.equal(
      await page.evaluate(SWAYING(500)),
      true,
      "a scroll starts it again",
    );
  } finally {
    await browser.close();
    server.close();
  }
});

test("a tab hidden past the idle interval comes back still, and a tap starts the sway", async (t) => {
  if (!labExport(t)) return;
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ channel: "chromium" });
  const { server, port } = await serveExport();
  try {
    const context = await browser.newContext({
      viewport: { width: 393, height: 700 },
    });
    const page = await context.newPage();
    await page.addInitScript(HIDDEN_TAB);
    await page.goto(`http://localhost:${port}${LAB_ROUTE}`, {
      waitUntil: "load",
    });
    await page.waitForSelector("[data-thread-opened]", {
      state: "attached",
      timeout: 15000,
    });
    await page.addStyleTag({ content: SHORT_IDLE });
    await page.keyboard.press("Shift");
    await page.evaluate("window.__setHidden(true)");
    await page.waitForTimeout(2500);
    await page.evaluate("window.__setHidden(false)");
    /* Past the return's own 1s rest, so the stillness read is the idle state's, not the rest's. */
    await page.waitForTimeout(1200);
    assert.equal(
      await page.evaluate(SWAYING(800)),
      false,
      "coming back is not an interaction: an idle page stays still",
    );
    await page.mouse.click(5, 5);
    await page.waitForTimeout(200);
    assert.equal(
      await page.evaluate(SWAYING(500)),
      true,
      "a tap starts the sway",
    );
  } finally {
    await browser.close();
    server.close();
  }
});

/* The sway is built once per page, so reduced motion turned on mid-visit has to reach it: the line stops and every
   piece goes back to its own unswayed shape — the shape a page with the sway off draws at the same size — with
   nothing left hidden; turned off again, the sway comes back. Read mid-scroll, so a piece was being cut at its tip. */
test("reduced motion turned on mid-visit stops the sway, restores every piece, and turning it off starts it again", async (t) => {
  if (!labExport(t)) return;
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ channel: "chromium" });
  const { server, port } = await serveExport();
  const PIECES = `[...[...document.querySelectorAll("[data-thread-svg]")].sort((a, b) => b.querySelectorAll("path[data-thread-piece]").length - a.querySelectorAll("path[data-thread-piece]").length)[0].querySelectorAll("path[data-thread-piece]")].map((p) => ({ d: p.getAttribute("d"), hidden: p.style.visibility === "hidden" }))`;
  try {
    const open = async (swayOff: boolean) => {
      const context = await browser.newContext({
        viewport: { width: 393, height: 700 },
      });
      const page = await context.newPage();
      if (swayOff) await page.addInitScript(SWAY_OFF);
      await page.goto(`http://localhost:${port}${LAB_ROUTE}`, {
        waitUntil: "load",
      });
      await page.waitForSelector("[data-thread-opened]", {
        state: "attached",
        timeout: 15000,
      });
      await page.evaluate("window.scrollTo(0, 900)");
      await page.waitForTimeout(1500);
      return page;
    };
    const unswayed = (await (await open(true)).evaluate(PIECES)) as {
      d: string;
    }[];
    const page = await open(false);
    assert.equal(await page.evaluate(SWAYING(500)), true, "the line sways");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForTimeout(800);
    assert.equal(
      await page.evaluate(SWAYING(800)),
      false,
      "reduced motion stops the sway",
    );
    const pieces = (await page.evaluate(PIECES)) as {
      d: string;
      hidden: boolean;
    }[];
    assert.equal(pieces.length, unswayed.length);
    pieces.forEach((piece, index) => {
      assert.equal(
        piece.d,
        unswayed[index].d,
        `piece ${index} is back to its unswayed shape`,
      );
      assert.equal(piece.hidden, false, `piece ${index} is not left hidden`);
    });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.waitForTimeout(500);
    assert.equal(
      await page.evaluate(SWAYING(800)),
      true,
      "turning reduced motion off starts the sway again",
    );
  } finally {
    await browser.close();
    server.close();
  }
});

/* The sway's frame loop shares the main thread with the page's own work, and on a phone it held a scroll near 24 fps
   and starved the lazy images and the first frames after a return (DESIGN.md -> Thread -> The sway). So it rests
   while the page scrolls and for a moment after the tab comes back: a drawn piece on screen holds its shape then. */
const FINISHED_PIECE = `(() => {
  const svg = [...document.querySelectorAll("[data-thread-svg]")].sort((a, b) => b.querySelectorAll("path[data-thread-piece]").length - a.querySelectorAll("path[data-thread-piece]").length)[0];
  const pieces = [...svg.querySelectorAll("path[data-thread-piece]")].filter((p) => p.style.visibility !== "hidden");
  const onScreen = pieces.slice(0, -2).filter((p) => { const r = p.getBoundingClientRect(); return r.bottom > 50 && r.top < innerHeight - 50; });
  return pieces.indexOf(onScreen[0]);
})()`;
const SHAPE_OF = (index: number) => `(() => {
  const svg = [...document.querySelectorAll("[data-thread-svg]")].sort((a, b) => b.querySelectorAll("path[data-thread-piece]").length - a.querySelectorAll("path[data-thread-piece]").length)[0];
  return [...svg.querySelectorAll("path[data-thread-piece]")].filter((p) => p.style.visibility !== "hidden")[${index}].getAttribute("d");
})()`;

test("the sway rests while the page scrolls, and sways again once it stops", async (t) => {
  if (!labExport(t)) return;
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ channel: "chromium" });
  const { server, port } = await serveExport();
  try {
    const page = await browser.newPage({
      viewport: { width: 393, height: 700 },
    });
    await page.goto(`http://localhost:${port}${LAB_ROUTE}`, {
      waitUntil: "load",
    });
    await page.waitForSelector("[data-thread-opened]", {
      state: "attached",
      timeout: 15000,
    });
    await page.evaluate("window.scrollTo(0, 900)");
    await page.waitForTimeout(1500);
    const index = (await page.evaluate(FINISHED_PIECE)) as number;
    assert.ok(index >= 0, "a drawn piece is on screen");
    /* Short scrolls with the sway awake between them, over more than a gust's 8s cycle, so some scroll begins
       while a gust is passing: a gust travels the window, and a rest must not let it follow the scroll. */
    const bursts = (await page.evaluate(`(async () => {
      const bursts = [];
      for (let b = 0; b < 24; b += 1) {
        const shapes = [];
        for (let k = 0; k < 8; k += 1) {
          window.scrollBy(0, 1);
          await new Promise((resolve) => setTimeout(resolve, 25));
          shapes.push(${SHAPE_OF(index)});
        }
        bursts.push(shapes);
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      return bursts;
    })()`)) as string[][];
    bursts.forEach((shapes, b) => {
      assert.equal(
        new Set(shapes.slice(2)).size,
        1,
        `a drawn piece holds its shape while the page scrolls (scroll ${b})`,
      );
    });
    await page.waitForTimeout(400);
    assert.equal(
      await page.evaluate(SWAYING(600)),
      true,
      "and sways again once the scroll stops",
    );
  } finally {
    await browser.close();
    server.close();
  }
});

/* A rest pauses the sway's clock with it, so the line carries on from the shape it held rather than jumping to
   wherever the clock reached in the meantime. Read just before and just after the return's 1s rest ends: the line
   may move as far as a few frames carry it, never the several pixels a jump would. */
const POINTS = (index: number) =>
  `(${SHAPE_OF(index)}).match(/-?\\d+\\.\\d+/g).map(Number)`;

test("after a rest the line carries on from where it stopped, without a jump", async (t) => {
  if (!labExport(t)) return;
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ channel: "chromium" });
  const { server, port } = await serveExport();
  try {
    const page = await browser.newPage({
      viewport: { width: 393, height: 700 },
    });
    await page.addInitScript(HIDDEN_TAB);
    await page.goto(`http://localhost:${port}${LAB_ROUTE}`, {
      waitUntil: "load",
    });
    await page.waitForSelector("[data-thread-opened]", {
      state: "attached",
      timeout: 15000,
    });
    await page.waitForTimeout(800);
    const index = (await page.evaluate(FINISHED_PIECE)) as number;
    assert.ok(index >= 0, "a drawn piece is on screen");
    await page.evaluate("window.__setHidden(true)");
    await page.waitForTimeout(2000);
    await page.evaluate("window.__setHidden(false)");
    await page.waitForTimeout(900);
    const held = (await page.evaluate(POINTS(index))) as number[];
    await page.waitForTimeout(150);
    const after = (await page.evaluate(POINTS(index))) as number[];
    assert.equal(after.length, held.length);
    const jump = Math.max(
      ...held.map((value, i) => Math.abs(after[i] - value)),
    );
    assert.ok(jump > 0, "the line moves again once the rest ends");
    assert.ok(
      jump < 2,
      `the line jumped ${jump.toFixed(2)}px when the rest ended`,
    );
  } finally {
    await browser.close();
    server.close();
  }
});

/* Every twist mark on screen whose midpoint lies off the ink it sits on. The sway reshapes only the paths near the
   window, each culled by its own box: a long piece of ink stays in range while a twist mark on its far end does not,
   so the two can hold different moments, and a rest lets the page scroll onto both before either is redrawn. */
const TWIST_OFF_INK = `(() => {
  const svg = [...document.querySelectorAll("[data-thread-svg]")].sort((a, b) => b.querySelectorAll("path[data-thread-piece]").length - a.querySelectorAll("path[data-thread-piece]").length)[0];
  const inks = [...svg.querySelectorAll("path[data-thread-piece]")].filter((p) => p.style.visibility !== "hidden");
  const marks = [...svg.querySelectorAll("[data-thread-twist] path")].filter((p) => p.style.display !== "none");
  const point = svg.createSVGPoint();
  let checked = 0;
  const off = [];
  for (const mark of marks) {
    const box = mark.getBoundingClientRect();
    if (box.bottom < 0 || box.top > innerHeight) continue;
    for (const gap of mark.getAttribute("d").split("M").slice(1)) {
      const numbers = gap.match(/-?\\d+(?:\\.\\d+)?/g).map(Number);
      const middle = Math.floor(numbers.length / 4) * 2;
      point.x = numbers[middle];
      point.y = numbers[middle + 1];
      checked += 1;
      if (!inks.some((ink) => ink.isPointInStroke(point))) off.push(point.x.toFixed(1) + "," + point.y.toFixed(1));
    }
  }
  return { checked, off };
})()`;

test("a rest never shows the twist apart from the ink, after a long scroll back up the drawn line", async (t) => {
  if (!labExport(t)) return;
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ channel: "chromium" });
  const { server, port } = await serveExport();
  try {
    const page = await browser.newPage({
      viewport: { width: 393, height: 700 },
    });
    await page.goto(`http://localhost:${port}${LAB_ROUTE}`, {
      waitUntil: "load",
    });
    await page.waitForSelector("[data-thread-opened]", {
      state: "attached",
      timeout: 15000,
    });
    for (let y = 300; y <= 3000; y += 300) {
      await page.evaluate(`window.scrollTo(0, ${y})`);
      await page.waitForTimeout(250);
    }
    /* Swaying long enough down here that everything above has stood still at older moments. */
    await page.waitForTimeout(2500);
    const awake = (await page.evaluate(TWIST_OFF_INK)) as {
      checked: number;
      off: string[];
    };
    assert.ok(awake.checked > 0, "twist marks are on screen while swaying");
    assert.deepEqual(
      awake.off,
      [],
      "swaying, every twist mark sits on its ink",
    );
    /* Read inside the scroll's 150ms rest, two frames after the jump has painted. */
    const rested = (await page.evaluate(`(async () => {
      window.scrollTo(0, 900);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return ${TWIST_OFF_INK};
    })()`)) as { checked: number; off: string[] };
    assert.ok(rested.checked > 0, "twist marks are on screen after the scroll");
    assert.deepEqual(
      rested.off,
      [],
      "resting, every twist mark on screen still sits on its ink",
    );
  } finally {
    await browser.close();
    server.close();
  }
});

/* Each catch-up frame rewrites every piece's dash. A piece whose drawn fraction did not change has nothing new to
   show, and re-shaping it — far off screen, at a fresh moment — invalidated the whole page-length line every frame
   while the page's images were loading. Moving the line is the sway's own frame's job, within its range. */
const FAR_PIECE_RESHAPES = (ms: number) => `(async () => {
  const svg = [...document.querySelectorAll("[data-thread-svg]")].sort((a, b) => b.querySelectorAll("path[data-thread-piece]").length - a.querySelectorAll("path[data-thread-piece]").length)[0];
  const far = (path) => { const r = path.getBoundingClientRect(); return r.bottom < -400 || r.top > innerHeight + 400; };
  const reshaped = new Set();
  const watch = new MutationObserver((records) => {
    for (const record of records) {
      const path = record.target;
      if (path.dataset.threadPiece !== undefined && far(path)) reshaped.add(path.dataset.threadPiece);
    }
  });
  watch.observe(svg, { subtree: true, attributes: true, attributeFilter: ["d"] });
  await new Promise((resolve) => setTimeout(resolve, ${ms}));
  watch.disconnect();
  return [...reshaped];
})()`;

test("a catch-up frame never re-shapes a drawn piece far off screen", async (t) => {
  if (!labExport(t)) return;
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ channel: "chromium" });
  const { server, port } = await serveExport();
  try {
    const page = await browser.newPage({
      viewport: { width: 393, height: 700 },
    });
    await page.goto(`http://localhost:${port}${LAB_ROUTE}`, {
      waitUntil: "load",
    });
    await page.waitForSelector("[data-thread-opened]", {
      state: "attached",
      timeout: 15000,
    });
    for (let y = 300; y <= 1800; y += 300) {
      await page.evaluate(`window.scrollTo(0, ${y})`);
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(1500);
    /* The scroll's rest is over by 200ms; the 0.6s catch-up is still running. */
    await page.evaluate("window.scrollBy(0, 300)");
    await page.waitForTimeout(200);
    assert.deepEqual(
      await page.evaluate(FAR_PIECE_RESHAPES(300)),
      [],
      "pieces far off screen were re-shaped during a catch-up",
    );
  } finally {
    await browser.close();
    server.close();
  }
});

test("a piece finished during a fling is whole when scrolled back to", async (t) => {
  if (!labExport(t)) return;
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ channel: "chromium" });
  const { server, port } = await serveExport();
  try {
    const page = await browser.newPage({
      viewport: { width: 393, height: 700 },
    });
    await page.goto(`http://localhost:${port}${LAB_ROUTE}`, {
      waitUntil: "load",
    });
    await page.waitForSelector("[data-thread-opened]", {
      state: "attached",
      timeout: 15000,
    });
    await page.evaluate(`(async () => {
      for (let k = 1; k <= 8; k += 1) {
        window.scrollTo(0, (3000 * k) / 8);
        await new Promise((resolve) => setTimeout(resolve, 300 / 8));
      }
    })()`);
    await page.waitForTimeout(1000);
    await page.evaluate("window.scrollTo(0, 900)");
    await page.waitForTimeout(400);
    const cut = (await page.evaluate(`(() => {
      const svg = [...document.querySelectorAll("[data-thread-svg]")].sort((a, b) => b.querySelectorAll("path[data-thread-piece]").length - a.querySelectorAll("path[data-thread-piece]").length)[0];
      const pieces = [...svg.querySelectorAll("path[data-thread-piece]")];
      const last = pieces.findLastIndex((p) => p.style.visibility !== "hidden");
      return pieces.slice(0, last).filter((p) => {
        const r = p.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight) return false;
        const end = p.getPointAtLength(p.getTotalLength());
        const next = pieces[pieces.indexOf(p) + 1].getPointAtLength(0);
        return Math.hypot(end.x - next.x, end.y - next.y) > 2;
      }).map((p) => p.dataset.threadPiece);
    })()`)) as string[];
    assert.deepEqual(
      cut,
      [],
      "a passed piece on screen stops short of the next",
    );
  } finally {
    await browser.close();
    server.close();
  }
});

/* A twist mark not yet reached and a head step not in use are kept with `display: none`: the sway's frame shapes
   only what is shown, and a mark takes its shape the moment it is shown. */
test("the sway never re-shapes a hidden twist mark or head step", async (t) => {
  if (!labExport(t)) return;
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ channel: "chromium" });
  const { server, port } = await serveExport();
  try {
    const page = await browser.newPage({
      viewport: { width: 393, height: 700 },
    });
    await page.goto(`http://localhost:${port}${LAB_ROUTE}`, {
      waitUntil: "load",
    });
    await page.waitForSelector("[data-thread-opened]", {
      state: "attached",
      timeout: 15000,
    });
    await page.waitForTimeout(1500);
    const reshaped = (await page.evaluate(`(async () => {
      const hidden = new Set();
      let watched = 0;
      const watch = new MutationObserver((records) => {
        for (const record of records) if (record.target.style.display === "none") hidden.add(record.target);
      });
      for (const svg of document.querySelectorAll("[data-thread-svg]")) {
        watched += [...svg.querySelectorAll("path")].filter((p) => p.style.display === "none").length;
        watch.observe(svg, { subtree: true, attributes: true, attributeFilter: ["d"] });
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
      watch.disconnect();
      return { watched, reshaped: hidden.size };
    })()`)) as { watched: number; reshaped: number };
    assert.ok(reshaped.watched > 0, "hidden marks exist to watch");
    assert.equal(
      reshaped.reshaped,
      0,
      "hidden marks were re-shaped while the sway moved",
    );
  } finally {
    await browser.close();
    server.close();
  }
});

/* A painter hides a head step as the draw arrives, often while the line is swaying: the style change that hides it is
   not a reason to re-shape it, and the frame the head is shown again shapes it then. */
test("hiding a twist mark or head step never re-shapes it", async (t) => {
  if (!labExport(t)) return;
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ channel: "chromium" });
  const { server, port } = await serveExport();
  try {
    const page = await browser.newPage({
      viewport: { width: 393, height: 700 },
    });
    await page.goto(`http://localhost:${port}${LAB_ROUTE}`, {
      waitUntil: "load",
    });
    await page.waitForSelector("[data-thread-opened]", {
      state: "attached",
      timeout: 15000,
    });
    await page.evaluate(`(() => {
      window.__hides = 0;
      window.__reshapedHidden = 0;
      const watch = new MutationObserver((records) => {
        for (const record of records) {
          if (record.target.style.display !== "none") continue;
          if (record.attributeName === "d") window.__reshapedHidden += 1;
          else if (!/display: none/.test(record.oldValue ?? "")) window.__hides += 1;
        }
      });
      for (const svg of document.querySelectorAll("[data-thread-svg]"))
        watch.observe(svg, { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ["d", "style"] });
    })()`);
    for (let y = 300; y <= 1800; y += 300) {
      await page.evaluate(`window.scrollTo(0, ${y})`);
      await page.waitForTimeout(400);
    }
    await page.waitForTimeout(1500);
    await page.evaluate("window.scrollTo(0, 600)");
    await page.waitForTimeout(1000);
    const seen = (await page.evaluate(
      "({ hides: window.__hides, reshaped: window.__reshapedHidden })",
    )) as { hides: number; reshaped: number };
    assert.ok(seen.hides > 0, "a mark or head step was hidden to watch");
    assert.equal(seen.reshaped, 0, "a path was re-shaped as it was hidden");
  } finally {
    await browser.close();
    server.close();
  }
});

test("coming back to the tab, the sway waits a second before it moves", async (t) => {
  if (!labExport(t)) return;
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ channel: "chromium" });
  const { server, port } = await serveExport();
  try {
    const page = await browser.newPage({
      viewport: { width: 393, height: 700 },
    });
    await page.addInitScript(HIDDEN_TAB);
    await page.goto(`http://localhost:${port}${LAB_ROUTE}`, {
      waitUntil: "load",
    });
    await page.waitForSelector("[data-thread-opened]", {
      state: "attached",
      timeout: 15000,
    });
    await page.waitForTimeout(500);
    await page.evaluate("window.__setHidden(true)");
    await page.waitForTimeout(300);
    await page.evaluate("window.__setHidden(false)");
    assert.equal(
      await page.evaluate(SWAYING(600)),
      false,
      "the first moments after a return are the page's",
    );
    await page.waitForTimeout(600);
    assert.equal(
      await page.evaluate(SWAYING(600)),
      true,
      "then the sway carries on",
    );
  } finally {
    await browser.close();
    server.close();
  }
});

/* A page that loads under reduced motion never starts the opening; turned off while the reader is still
   at the top, the opening then runs, rather than leaving the invite's stretch undrawn until the first
   scroll. Loading reduced, rather than switching mid-load, keeps the case deterministic: a switch that
   lands after the draw has begun leaves part of it on the ratchet either way. */
test("motion arriving at the top runs the opening that reduced motion held back", async (t) => {
  if (!labExport(t)) return;
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ channel: "chromium" });
  const { server, port } = await serveExport();
  try {
    const page = await (
      await browser.newContext({
        viewport: { width: 393, height: 700 },
        reducedMotion: "reduce",
      })
    ).newPage();
    await page.addInitScript(SWAY_OFF);
    await page.goto(`http://localhost:${port}${LAB_ROUTE}`, {
      waitUntil: "load",
    });
    await page.waitForTimeout(500);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    assert.equal(
      await page.evaluate("window.scrollY"),
      0,
      "the reader is still at the top",
    );
    /* A re-armed draw starts at once and lasts 1200ms; this outlasts it. */
    await page.waitForTimeout(3000);
    const drawn = (await page.evaluate(`(() => {
      const pieces = Array.from(document.querySelectorAll("path[data-thread-piece]"));
      return pieces.filter((p) => {
        const offset = parseFloat(p.style.strokeDashoffset);
        return Number.isFinite(offset) && offset < parseFloat(p.style.strokeDasharray) - 1;
      }).length;
    })()`)) as number;
    assert.ok(
      drawn > 0,
      "the opening drew the invite's stretch once motion came back",
    );
  } finally {
    await browser.close();
    server.close();
  }
});

/* Reduced motion keeps the material and drops the motion (DESIGN.md -> Thread -> The twist): the rope's
   chunks are present and hold still. The sway is not seeded off here — under reduce it never starts, and
   that is part of what this pins. */
test("under reduced motion the twist is present and static", async (t) => {
  if (!labExport(t)) return;
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ channel: "chromium" });
  const { server, port } = await serveExport();
  try {
    const page = await (
      await browser.newContext({
        viewport: { width: 393, height: 700 },
        reducedMotion: "reduce",
      })
    ).newPage();
    await page.goto(`http://localhost:${port}${LAB_ROUTE}`, {
      waitUntil: "load",
    });
    await page.waitForSelector("[data-thread-twist] path", {
      state: "attached",
      timeout: 15000,
    });
    const shapes = `Array.from(document.querySelectorAll("[data-thread-twist] path")).map((p) => p.getAttribute("d") + "|" + p.style.display).join("\\n")`;
    const first = (await page.evaluate(shapes)) as string;
    await page.waitForTimeout(1000);
    const second = (await page.evaluate(shapes)) as string;
    assert.ok(
      first.split("\n").length > 0 && first !== "",
      "the twist has chunks",
    );
    assert.equal(second, first, "the twist moved under reduced motion");
  } finally {
    await browser.close();
    server.close();
  }
});
