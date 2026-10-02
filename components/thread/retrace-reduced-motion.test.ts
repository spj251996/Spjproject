import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join } from "node:path";
import test from "node:test";

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
      await page.goto(`http://localhost:${port}/`, { waitUntil: "load" });
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
