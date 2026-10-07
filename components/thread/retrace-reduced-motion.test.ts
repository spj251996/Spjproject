import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join } from "node:path";
import test from "node:test";

/* The thread is not on the published page -- `/` carries none since the lab split, so a gate pointed
   there measures a thread-free page and reads as a product defect (DESIGN.md -> Technical Conventions
   -> Variant Routes). The `.html` is explicit because `serveExport` below serves literal paths and a
   static export emits a dynamic route as `out/thread/<variant>.html`; `/thread/current` would resolve
   to the sibling RSC-payload DIRECTORY, and `/thread/current/` to a 404. */
const LAB_ROUTE = "/thread/current.html";

/* Reduced motion collapses the re-trace to nothing, and only a real page can show it: the whole
   collapse hangs on one `reducedMotion()` check in `syncRetrace`, and the loop is script, so
   `document.getAnimations()` is no longer evidence either way (it reads 0 whether or not a loop runs).
   What distinguishes the two states is the re-trace's own DOM: how many stretches were built, how many
   glow paths are showing, and whether the thread's pieces are dashed. Run against the static export,
   as the built-artifact tests are, and skipped, saying so, without one; a browser that will not
   launch fails it. */

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
  stretches: number;
  runPathsShown: number;
  glowPathsShown: number;
  pieces: number;
  undashed: number;
}

const READ = `(() => {
  const pieces = Array.from(document.querySelectorAll("path[data-thread-piece]"));
  return {
    stretches: document.querySelectorAll("[data-thread-retrace-group]").length,
    runPathsShown: Array.from(document.querySelectorAll("[data-thread-retrace-group] path")).filter((p) => p.style.display !== "none").length,
    glowPathsShown: Array.from(document.querySelectorAll("[data-thread-retrace-glow] path")).filter((p) => p.style.display !== "none").length,
    pieces: pieces.length,
    undashed: pieces.filter((p) => p.style.strokeDasharray === "").length,
  };
})()`;

test("reduced motion builds no re-trace, stops a running one, and leaves the thread undashed; with motion it builds both", async (t) => {
  if (!existsSync("out/index.html")) {
    t.skip("no static export: run `npm run build` first");
    return;
  }
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
      await page.goto(`http://localhost:${port}${LAB_ROUTE}`, {
        waitUntil: "load",
      });
      return page;
    };
    const [reduced, moving] = await Promise.all([
      open("reduce"),
      open("no-preference"),
    ]);
    /* The opening draw ends at 3400ms and the first re-trace frame follows it, so by 5s a loop that
       was going to start has started. */
    await moving.waitForFunction(
      "document.querySelector('[data-thread-retrace-group]') !== null",
      null,
      { timeout: 15000 },
    );
    await reduced.waitForTimeout(5000);
    const reducedAtTop = (await reduced.evaluate(READ)) as Reading;
    await reduced.evaluate(
      "window.scrollTo(0, document.documentElement.scrollHeight)",
    );
    await reduced.waitForTimeout(1500);
    const reducedAtBottom = (await reduced.evaluate(READ)) as Reading;
    const movingReading = (await moving.evaluate(READ)) as Reading;
    /* The preference can change under a running loop. Nothing else stops it then: the scroll and the
       opening draw gate themselves, and a loop already going is stopped only by the check in
       `syncRetrace`, which the page's re-measure on the change reaches. */
    await moving.emulateMedia({ reducedMotion: "reduce" });
    await moving.waitForTimeout(1500);
    const switchedToReduce = (await moving.evaluate(READ)) as Reading;

    for (const [where, reading] of [
      ["at the top", reducedAtTop],
      ["at the bottom", reducedAtBottom],
    ] as const) {
      assert.equal(
        reading.stretches,
        0,
        `no stretch is built ${where} under reduced motion`,
      );
      assert.equal(reading.glowPathsShown, 0, `no glow path shows ${where}`);
      assert.ok(reading.pieces > 0, "the thread is on the page");
      assert.equal(
        reading.undashed,
        reading.pieces,
        `every piece is complete ${where}`,
      );
    }
    assert.ok(movingReading.stretches >= 1, "with motion a stretch is built");
    assert.ok(
      movingReading.runPathsShown >= 8,
      "with motion the core's runs show",
    );
    assert.equal(
      switchedToReduce.runPathsShown + switchedToReduce.glowPathsShown,
      0,
      "a loop already running stops when the preference changes to reduce",
    );
    assert.equal(
      switchedToReduce.undashed,
      switchedToReduce.pieces,
      "and the thread is left complete",
    );
    assert.ok(
      movingReading.glowPathsShown >= 8,
      "with motion the glow's strokes show",
    );
    assert.ok(
      movingReading.undashed < movingReading.pieces,
      "with motion the thread is still being drawn, so some piece is dashed",
    );
  } finally {
    await browser.close();
    server.close();
  }
});

/* The bounded loop's lifecycle, which only a real page can show: what is scheduled and what is painted.
   The loop's tokens are overridden with a shorter pace so a whole budget fits inside a test: they are
   read by name from the stylesheet, which is what is being relied on. `requestAnimationFrame` is
   wrapped to keep a count of callbacks still scheduled, because "nothing is running" has to mean no
   chain is left behind painting nothing, not only that nothing is visible; and the page's visibility
   is driven by overriding what `document.visibilityState` reads, since a headless page is always
   visible. The only other rAF user is the opening draw, which has ended by the time a stretch is lit. */

const FAST_TOKENS =
  /* `--retrace-speed:0` pins the FIXED-DURATION path deliberately: with a speed set, a loop lasts as
   long as the stretch needs and the injected `--retrace-duration` no longer governs, so these cases
   could not state a budget in milliseconds at all. The speed model's own arithmetic is covered
   without a browser in `thread-light.test.ts`. */
  ":root{--retrace-duration:600ms;--retrace-loops:2;--retrace-settle:300ms;--retrace-speed:0}";

const WRAP_RAF = `(() => {
  const pending = new Set();
  const raf = window.requestAnimationFrame.bind(window);
  const caf = window.cancelAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => {
    const id = raf((t) => { pending.delete(id); cb(t); });
    pending.add(id);
    return id;
  };
  window.cancelAnimationFrame = (id) => { pending.delete(id); caf(id); };
  window.__pending = () => pending.size;
  let hidden = false;
  Object.defineProperty(document, "visibilityState", { get: () => (hidden ? "hidden" : "visible"), configurable: true });
  window.__setHidden = (value) => { hidden = value; document.dispatchEvent(new Event("visibilitychange")); };
})()`;

interface Lifecycle {
  pending: number;
  lit: number;
}

const LIFECYCLE = `(() => {
  const lit = (root) => Array.from(root.querySelectorAll("[data-thread-retrace-group] path, [data-thread-retrace-glow] path"))
    .filter((p) => p.style.display !== "none" && p.getAttribute("d")).length;
  return {
    pending: window.__pending(),
    lit: lit(document),
  };
})()`;

test("the re-trace stops when its budget of loops is spent, suspends in a hidden tab without spending any, and a scroll starts it again", async (t) => {
  if (!existsSync("out/index.html")) {
    t.skip("no static export: run `npm run build` first");
    return;
  }
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ channel: "chromium" });
  const { server, port } = await serveExport();
  try {
    const context = await browser.newContext({
      viewport: { width: 393, height: 700 },
    });
    const page = await context.newPage();
    await page.addInitScript(WRAP_RAF);
    await page.goto(`http://localhost:${port}${LAB_ROUTE}`, {
      waitUntil: "load",
    });
    await page.addStyleTag({ content: FAST_TOKENS });
    const read = async () => (await page.evaluate(LIFECYCLE)) as Lifecycle;
    const waitFor = (condition: string, timeout = 15000) =>
      page.waitForFunction(condition, null, { timeout, polling: 25 });

    await waitFor(
      "[...document.querySelectorAll('[data-thread-retrace-group] path')].some((p) => p.style.display !== 'none' && p.getAttribute('d'))",
    );
    const running = await read();
    assert.ok(running.lit > 0, "the loop is lit");
    assert.ok(running.pending >= 1, "and a frame is scheduled");

    await page.evaluate("window.__setHidden(true)");
    await page.waitForTimeout(300);
    assert.equal((await read()).pending, 0, "a hidden tab schedules no frame");
    /* Far longer than the whole budget (two 600ms loops): were hidden time counted against it, the
       loop would be spent on return and would never light again. */
    await page.waitForTimeout(2500);
    assert.equal(
      (await read()).pending,
      0,
      "and stays unscheduled while hidden",
    );
    await page.evaluate("window.__setHidden(false)");
    await waitFor(
      "[...document.querySelectorAll('[data-thread-retrace-group] path')].some((p) => p.style.display !== 'none' && p.getAttribute('d'))",
      1500,
    );
    assert.ok(
      (await read()).pending >= 1,
      "a visible tab resumes the remainder",
    );

    /* The remainder is at most two loops, 1.2s; it has ended well inside four. */
    await waitFor("window.__pending() === 0", 4000);
    const spent = await read();
    assert.equal(spent.lit, 0, "a spent budget leaves nothing painted");
    assert.equal(spent.pending, 0, "and no frame scheduled");
    await page.waitForTimeout(1500);
    const stillQuiet = await read();
    assert.equal(stillQuiet.lit + stillQuiet.pending, 0, "and it stays quiet");

    /* Things that are not movement reach the same sync: a tab coming back and a re-measure on resize.
       A spent budget has to survive them, or any of them would start another budget. */
    await page.evaluate("window.__setHidden(true)");
    await page.evaluate("window.__setHidden(false)");
    await page.evaluate("window.dispatchEvent(new Event('resize'))");
    /* Sampled across the whole window rather than read at its end: a loop wrongly restarted would
       spend its own short budget and be quiet again by then. The resize is debounced by 150ms. */
    let loudest = 0;
    for (let i = 0; i < 30; i++) {
      const sample = await read();
      loudest = Math.max(loudest, sample.lit + sample.pending);
      await page.waitForTimeout(30);
    }
    assert.equal(
      loudest,
      0,
      "a tab flip and a resize do not bring a spent loop back",
    );

    await page.evaluate("window.scrollBy(0, 40)");
    await waitFor(
      "[...document.querySelectorAll('[data-thread-retrace-group] path')].some((p) => p.style.display !== 'none' && p.getAttribute('d'))",
      4000,
    );
    assert.ok(
      (await read()).pending >= 1,
      "a scroll starts it again once the page has been still",
    );
    await waitFor("window.__pending() === 0", 4000);
    assert.equal((await read()).lit, 0, "and it spends its budget again");
  } finally {
    await browser.close();
    server.close();
  }
});

test("Wishes' closing stretch loops, painted by the one card thread and nowhere else", async (t) => {
  if (!existsSync("out/index.html")) {
    t.skip("no static export: run `npm run build` first");
    return;
  }
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ channel: "chromium" });
  const { server, port } = await serveExport();
  try {
    const page = await (
      await browser.newContext({ viewport: { width: 393, height: 700 } })
    ).newPage();
    await page.addInitScript(WRAP_RAF);
    await page.goto(`http://localhost:${port}${LAB_ROUTE}`, {
      waitUntil: "load",
    });
    await page.addStyleTag({
      content:
        ":root{--retrace-duration:1000ms;--retrace-loops:6;--retrace-settle:300ms;--retrace-speed:0}",
    });
    await page.waitForTimeout(3600);
    await page.evaluate(
      "window.scrollTo(0, document.documentElement.scrollHeight)",
    );
    /* The loop is seen lit by polling across it: a segment is empty at each loop's edges, so one
       reading can miss it. */
    let lit = 0;
    for (let i = 0; i < 120 && !lit; i++) {
      lit = (await page.evaluate(
        "Array.from(document.querySelectorAll('[data-thread-card] [data-thread-retrace-group] path, [data-thread-card] [data-thread-retrace-glow] path')).filter((p) => p.style.display !== 'none' && p.getAttribute('d')).length",
      )) as number;
      await page.waitForTimeout(50);
    }
    assert.ok(lit > 0, "the card thread's stretch is lit");
    assert.equal(
      await page.evaluate(
        "document.querySelectorAll('[data-thread-card]').length",
      ),
      1,
      "Wishes carries one card thread, not a copy either side of the illustration",
    );
    assert.equal(
      await page.evaluate(
        "document.querySelectorAll('[data-thread-card] [data-thread-retrace-group]').length",
      ),
      1,
      "and it holds one re-trace group",
    );
  } finally {
    await browser.close();
    server.close();
  }
});

test("on a finished thread a scroll clears the loop at once, and it lights again once the page is still", async (t) => {
  if (!existsSync("out/index.html")) {
    t.skip("no static export: run `npm run build` first");
    return;
  }
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ channel: "chromium" });
  const { server, port } = await serveExport();
  try {
    const page = await (
      await browser.newContext({ viewport: { width: 393, height: 700 } })
    ).newPage();
    await page.addInitScript(WRAP_RAF);
    await page.goto(`http://localhost:${port}${LAB_ROUTE}`, {
      waitUntil: "load",
    });
    await page.addStyleTag({
      content:
        ":root{--retrace-duration:1000ms;--retrace-loops:8;--retrace-settle:600ms;--retrace-speed:0}",
    });
    await page.waitForTimeout(3600);
    /* Complete the thread, then rest mid-page, where only phase 2 can light a stretch. */
    await page.evaluate(
      "window.scrollTo(0, document.documentElement.scrollHeight)",
    );
    await page.waitForTimeout(800);
    await page.evaluate("window.scrollTo(0, 2000)");
    const lit = `[...document.querySelectorAll('[data-thread-retrace-group] path')].some((p) => p.style.display !== 'none' && p.getAttribute('d'))`;
    await page.waitForFunction(lit, null, { timeout: 4000, polling: 25 });
    await page.evaluate("window.scrollBy(0, 10)");
    /* Two frames: the scroll handler is rAF-throttled, so a reading in the same task is the old state. */
    await page.evaluate(
      "new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))",
    );
    assert.equal(
      await page.evaluate(`!(${lit})`),
      true,
      "a scroll on a finished thread clears the loop",
    );
    assert.equal(
      ((await page.evaluate(LIFECYCLE)) as Lifecycle).pending,
      0,
      "and leaves no frame scheduled",
    );
    await page.waitForFunction(lit, null, { timeout: 4000, polling: 25 });
  } finally {
    await browser.close();
    server.close();
  }
});
