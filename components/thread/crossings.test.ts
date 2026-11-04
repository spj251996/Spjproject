import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join } from "node:path";
import test from "node:test";
import { labExport } from "../../scripts/lib/built-export.ts";

/* CROSSINGS ON THE PAGE (DESIGN.md -> Thread -> Crossings): each crossing's upper strand redrawn over
   the lower in the layer its order names — under the head when the later pass is on top, over it when
   the earlier one is — shown only once its later pass is drawn, and rebuilt when the page re-measures. */

const LAB_ROUTE = "/thread.html";

const SWAY_OFF = `(() => {
  const off = () => {
    if (!document.documentElement) return false;
    document.documentElement.dataset.threadSway = "off";
    return true;
  };
  if (!off()) new MutationObserver((_, watcher) => off() && watcher.disconnect()).observe(document, { childList: true });
})()`;

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

const BANDS = [
  { name: "tall", width: 393, height: 852 },
  { name: "upright", width: 834, height: 1112 },
  { name: "wide", width: 1536, height: 695 },
];

/* Every crossing overlay on the page: its layer, its order, where it sits, and whether the piece its
   showing waits on has drawn far enough — read from that piece's own dash in the same svg. */
const READ = `(() => {
  const shown = (el) => el.style.display !== "none" && (!el.parentElement || el.parentElement.style.display !== "none");
  return Array.from(document.querySelectorAll("g[data-thread-crossing]")).map((g) => {
    const svg = g.closest("svg");
    const head = svg.querySelector("[data-thread-head]");
    const piece = svg.querySelectorAll("path[data-thread-piece]")[Number(g.dataset.showPiece)];
    const period = Number.parseFloat(piece.style.strokeDasharray);
    const offset = Number.parseFloat(piece.style.strokeDashoffset);
    const painted = Number.isFinite(period) && Number.isFinite(offset) ? period - offset : Infinity;
    return {
      layer: g.parentElement.dataset.threadCrossings,
      over: g.dataset.over,
      woven: g.dataset.woven === "true",
      at: Math.round(Number(g.dataset.x)) + "," + Math.round(Number(g.dataset.y)),
      passes: g.dataset.showPiece + "@" + g.dataset.showFrom,
      shown: shown(g),
      /* Worked out here from where the later pass crosses, never read back from the painter's own threshold:
         3x the 2.2px cord either side, the earlier pass on top showing as the later pass arrives and the
         later pass on top once drawn across its whole overlay. */
      ready: painted >= Number(g.dataset.laterAt) + (g.dataset.over === "first" ? -6.6 : 6.6) - 1,
      aboveHead: Boolean(head.compareDocumentPosition(g) & Node.DOCUMENT_POSITION_FOLLOWING),
    };
  });
})()`;

type Overlay = {
  passes: string;
  layer: string;
  over: string;
  woven: boolean;
  at: string;
  shown: boolean;
  ready: boolean;
  aboveHead: boolean;
};

test("every crossing has one overlay, in the layer its order names", async (t) => {
  if (!labExport(t)) return;
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ channel: "chromium" });
  const { server, port } = await serveExport();
  try {
    for (const band of BANDS) {
      const context = await browser.newContext({
        viewport: { width: band.width, height: band.height },
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      await page.goto(`http://localhost:${port}${LAB_ROUTE}`, {
        waitUntil: "load",
      });
      await page.waitForTimeout(1500);
      const overlays = (await page.evaluate(READ)) as Overlay[];
      assert.ok(overlays.length > 0, `${band.name}: no crossing overlays`);
      assert.ok(
        overlays.some((overlay) => overlay.woven),
        `${band.name}: no motif crossing is woven`,
      );
      for (const overlay of overlays) {
        assert.equal(
          overlay.layer,
          overlay.over === "first" ? "over" : "under",
          `${band.name} at ${overlay.at}: the ${overlay.over} pass on top sits in the ${overlay.layer} layer`,
        );
        assert.equal(overlay.aboveHead, overlay.over === "first");
        assert.ok(
          overlay.shown,
          `${band.name} at ${overlay.at}: hidden under reduced motion`,
        );
      }
      assert.equal(
        new Set(overlays.map((overlay) => `${overlay.at} ${overlay.passes}`))
          .size,
        overlays.length,
        `${band.name}: two overlays at one crossing`,
      );
      t.diagnostic(
        `${band.name}: ${overlays.length} overlays, ${overlays.filter((o) => o.woven).length} woven, ${overlays.filter((o) => o.layer === "over").length} over the head`,
      );
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
});

test("an overlay appears only once its later pass is drawn", async (t) => {
  if (!labExport(t)) return;
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ channel: "chromium" });
  const { server, port } = await serveExport();
  try {
    for (const band of BANDS) {
      const context = await browser.newContext({
        viewport: { width: band.width, height: band.height },
      });
      const page = await context.newPage();
      await page.addInitScript(SWAY_OFF);
      await page.goto(`http://localhost:${port}${LAB_ROUTE}`, {
        waitUntil: "load",
      });
      await page.waitForTimeout(3600);
      const maxScroll = (await page.evaluate(
        "document.documentElement.scrollHeight - window.innerHeight",
      )) as number;
      let seenHidden = 0;
      let seenShown = 0;
      for (let y = 0; y <= maxScroll; y += Math.max(80, maxScroll / 30)) {
        await page.evaluate(`window.scrollTo(0, ${y})`);
        await page.waitForTimeout(700);
        for (const overlay of (await page.evaluate(READ)) as Overlay[]) {
          if (!overlay.shown) seenHidden += 1;
          else {
            seenShown += 1;
            assert.ok(
              overlay.ready,
              `${band.name} at ${Math.round(y)}: the overlay at ${overlay.at} shows before its later pass is drawn`,
            );
          }
        }
      }
      assert.ok(
        seenHidden > 0 && seenShown > 0,
        `${band.name}: overlays never changed state`,
      );
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
});

test("a resize rebuilds the overlays where a fresh load puts them", async (t) => {
  if (!labExport(t)) return;
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ channel: "chromium" });
  const { server, port } = await serveExport();
  const positions = async (page: import("playwright").Page) =>
    ((await page.evaluate(READ)) as Overlay[])
      .map((overlay) => overlay.at)
      .sort();
  try {
    const context = await browser.newContext({
      viewport: { width: 1536, height: 695 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.goto(`http://localhost:${port}${LAB_ROUTE}`, {
      waitUntil: "load",
    });
    await page.waitForTimeout(1500);
    await page.setViewportSize({ width: 1280, height: 695 });
    await page.waitForTimeout(1500);
    const resized = await positions(page);
    assert.ok(resized.length > 0, "no overlays after the resize");
    const fresh = await context.newPage();
    await fresh.setViewportSize({ width: 1280, height: 695 });
    await fresh.goto(`http://localhost:${port}${LAB_ROUTE}`, {
      waitUntil: "load",
    });
    await fresh.waitForTimeout(1500);
    assert.deepEqual(resized, await positions(fresh));
  } finally {
    await browser.close();
    server.close();
  }
});
