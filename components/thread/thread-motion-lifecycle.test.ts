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
