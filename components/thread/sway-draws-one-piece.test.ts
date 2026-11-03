import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join } from "node:path";
import test from "node:test";
import { labExport } from "../../scripts/lib/built-export.ts";

/* WHILE THE LINE SWAYS, IT DRAWS ONE STRETCH AT A TIME — the owner's iPhone report, 2026-11-01 and again
   2026-11-02: "the stretch from motif to next motif all start drawing at same time". The sway rewrites every
   piece's `d` each frame, and on an iPhone a dashed piece then painted ink past its tip. So while the sway
   runs no piece carries a dash at all: the piece being drawn is cut at its tip, and nothing past the tip
   exists to paint. No browser here reproduces the iPhone's defect, so this pins the property that removes
   it: no dash, ever, while swaying, and the drawn pieces are an unbroken run from the start with at most one
   of them cut short — the one at the tip.

   A piece is CUT when its last point does not meet the next piece's first. Two pieces meeting at one point
   move together under the sway (measured: under 0.1px apart at rest), so 1px separates a cut piece from a
   whole one — on screen. Off it, the sway leaves a path alone once it is more than its margin beyond the
   window, so a join there can stand a pixel or so open where nobody can see it; only joins on screen are
   read.

   Run against the static export with the sway ON (no seam), and skipped, saying so, without one. */

const LAB_ROUTE = "/thread.html";
const JOIN = 1;

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

/* One frame's reading of every thread `<svg>`: how many pieces carry a dash, whether the shown pieces are an
   unbroken run from the first, which shown pieces are cut, and how many are shown. */
const READ = `(() => {
  const number = /-?\\d*\\.?\\d+(?:[eE][-+]?\\d+)?/g;
  return Array.from(document.querySelectorAll("[data-thread-svg]")).map((svg) => {
    const pieces = Array.from(svg.querySelectorAll("path[data-thread-piece]"));
    const ends = pieces.map((p) => {
      const n = (p.getAttribute("d") ?? "").match(number)?.map(Number) ?? [];
      return { first: [n[0], n[1]], last: [n[n.length - 2], n[n.length - 1]], empty: n.length < 4 };
    });
    const shown = pieces.map((p, i) => p.style.visibility !== "hidden" && !ends[i].empty);
    const matrix = svg.getScreenCTM();
    const onScreen = ([x, y]) => {
      const top = matrix.b * x + matrix.d * y + matrix.f;
      return top >= 0 && top <= innerHeight;
    };
    const cut = [];
    for (let i = 0; i + 1 < pieces.length; i += 1) {
      if (!shown[i] || !onScreen(ends[i].last)) continue;
      const gap = Math.hypot(ends[i + 1].first[0] - ends[i].last[0], ends[i + 1].first[1] - ends[i].last[1]);
      if (gap > ${JOIN}) cut.push(i);
    }
    const lastShown = shown.lastIndexOf(true);
    return {
      dashed: pieces.filter((p) => { const a = getComputedStyle(p).strokeDasharray; return a !== "none" && a !== ""; }).length,
      unbroken: shown.every((s, i) => s || i > lastShown),
      cut,
      lastShown,
      shownCount: shown.filter(Boolean).length,
      pieces: pieces.length,
    };
  });
})()`;

type Reading = {
  dashed: number;
  unbroken: boolean;
  cut: number[];
  lastShown: number;
  shownCount: number;
  pieces: number;
};

test("while the line sways, no piece is dashed, and only the piece at the tip is drawn short", async (t) => {
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
    assert.equal(
      await page.evaluate(
        "document.documentElement.dataset.threadSway ?? null",
      ),
      null,
      "the sway is on for this test",
    );

    /* A fling: twelve steps to the page's end, one frame each, then thirty frames sampled after each, so the
       catch-up is caught mid-flight across many pieces. Then three steps back up. */
    const max = (await page.evaluate(
      "document.documentElement.scrollHeight - innerHeight",
    )) as number;
    const positions = [
      ...Array.from({ length: 12 }, (_, i) => ((i + 1) / 12) * max),
      ...Array.from({ length: 3 }, (_, i) => max * (1 - (i + 1) * 0.1)),
    ];
    const readings = (await page.evaluate(
      `(async (positions) => {
        const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
        const out = [];
        for (const y of positions) {
          window.scrollTo(0, y);
          await frame();
          for (let f = 0; f < 30; f += 1) {
            await frame();
            out.push(${READ});
          }
        }
        return out;
      })(${JSON.stringify(positions)})`,
    )) as Reading[][];

    /* A reading of nothing passes every check below, so the run must have read the thread and caught it
       mid-draw at least once. */
    assert.ok(readings.length > 0, "no frame was read");
    assert.ok(
      readings.every(
        (frame) => frame.reduce((n, svg) => n + svg.pieces, 0) > 0,
      ),
      "a frame read no thread pieces",
    );
    assert.ok(
      readings.some((frame) => frame.some((svg) => svg.cut.length === 1)),
      "no frame caught a piece mid-draw, so the fling proved nothing",
    );

    const peak: number[] = [];
    readings.forEach((frame, index) => {
      frame.forEach((svg, s) => {
        const where = `frame ${index}, svg ${s}`;
        assert.equal(
          svg.dashed,
          0,
          `${where}: a piece is dashed while swaying`,
        );
        assert.ok(
          svg.unbroken,
          `${where}: a piece is shown after a hidden one`,
        );
        assert.ok(
          svg.cut.length <= 1,
          `${where}: ${svg.cut.length} pieces are cut`,
        );
        if (svg.cut.length === 1)
          assert.equal(
            svg.cut[0],
            svg.lastShown,
            `${where}: the cut piece is not at the tip`,
          );
        /* The ratchet: scrolling back up never hides a piece once shown. */
        assert.ok(
          svg.shownCount >= (peak[s] ?? 0),
          `${where}: a shown piece was hidden again`,
        );
        peak[s] = Math.max(peak[s] ?? 0, svg.shownCount);
      });
    });

    /* Settled at the end, every piece is whole: a cut ever taken for a piece's geometry would leave it short
       here, with its join open. */
    await page.evaluate(`window.scrollTo(0, ${max})`);
    await page.waitForTimeout(2500);
    for (const [s, svg] of (
      (await page.evaluate(READ)) as Reading[]
    ).entries()) {
      assert.deepEqual(svg.cut, [], `svg ${s}: a finished piece is still cut`);
      assert.equal(svg.dashed, 0, `svg ${s}: a finished piece is dashed`);
    }
  } finally {
    await browser.close();
    server.close();
  }
});

/* The share of the twist's chunks shown: the draw's own progress, untouched by the sway (see
   `resize-keeps-draw.test.ts`). */
const TWIST_SHARE = `(() => {
  const chunks = Array.from(document.querySelectorAll("[data-thread-twist] path"));
  return chunks.length === 0 ? 0 : chunks.filter((c) => c.style.display !== "none").length / chunks.length;
})()`;

/* Scrolling back up WHILE a piece is still being drawn: the tip keeps its place — no shown piece hides
   again, the tip piece never moves back, and the draw's progress never falls. */
test("with the sway on, scrolling back up mid-draw never un-draws the line", async (t) => {
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
    const samples = (await page.evaluate(
      `(async () => {
        const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
        const max = document.documentElement.scrollHeight - innerHeight;
        window.scrollTo(0, max * 0.3);
        for (let f = 0; f < 60; f += 1) await frame();
        window.scrollTo(0, max * 0.6);
        for (let f = 0; f < 4; f += 1) await frame();
        const out = [];
        for (const back of [0.5, 0.4, 0.3]) {
          window.scrollTo(0, max * back);
          for (let f = 0; f < 15; f += 1) {
            await frame();
            out.push({ svgs: ${READ}, share: ${TWIST_SHARE} });
          }
        }
        return out;
      })()`,
    )) as { svgs: Reading[]; share: number }[];
    assert.ok(
      samples.some((sample) => sample.svgs.some((svg) => svg.cut.length === 1)),
      "no frame on the way back up had a piece mid-draw, so this proved nothing",
    );
    let share = 0;
    const tip: number[] = [];
    samples.forEach((sample, index) => {
      assert.ok(
        sample.share >= share,
        `frame ${index}: the draw fell back from ${share} to ${sample.share}`,
      );
      share = sample.share;
      sample.svgs.forEach((svg, s) => {
        assert.ok(
          svg.lastShown >= (tip[s] ?? -1),
          `frame ${index}, svg ${s}: the tip moved back from piece ${tip[s]} to ${svg.lastShown}`,
        );
        tip[s] = svg.lastShown;
      });
    });
  } finally {
    await browser.close();
    server.close();
  }
});

/* While the page is idle the sway has stopped, and the line stays where it stopped: a draw that writes the
   pieces again (a resize, with the layout unchanged) must not move the ink to a new moment of the sway,
   or the ink parts from the twist, the head and the tapered ends, which do not move. The page's clock is
   driven so the idle timeout arrives without a minute's wait. */
test("while the page is idle, a redraw leaves the swayed ink where it stopped", async (t) => {
  if (!labExport(t)) return;
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ channel: "chromium" });
  const { server, port } = await serveExport();
  try {
    const page = await browser.newPage({
      viewport: { width: 393, height: 700 },
    });
    await page.clock.install();
    await page.goto(`http://localhost:${port}${LAB_ROUTE}`, {
      waitUntil: "load",
    });
    await page.waitForSelector("[data-thread-opened]", {
      state: "attached",
      timeout: 15000,
    });
    await page.evaluate(
      "window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * 0.4)",
    );
    await page.waitForTimeout(1500);
    /* Only the pieces on screen: the sway leaves a path more than its margin beyond the window unmoved, so one
       off screen still holds an older moment and is brought to the stopped one by the redraw — unseen. */
    const shapes = `Array.from(document.querySelectorAll("[data-thread-svg] path[data-thread-piece]")).filter((p) => { const r = p.getBoundingClientRect(); return p.style.visibility !== "hidden" && r.bottom > 0 && r.top < innerHeight; }).map((p) => p.dataset.threadPiece + ":" + p.getAttribute("d")).join("|")`;
    await page.clock.fastForward(65_000);
    await page.waitForTimeout(500);
    const idle = (await page.evaluate(shapes)) as string;
    assert.notEqual(
      idle,
      "",
      "no piece of the line is on screen, so this proves nothing",
    );
    await page.waitForTimeout(500);
    assert.equal(
      await page.evaluate(shapes),
      idle,
      "the sway is still moving after the idle timeout, so this proves nothing",
    );
    await page.evaluate("window.dispatchEvent(new Event('resize'))");
    await page.waitForTimeout(1000);
    assert.equal(
      await page.evaluate(shapes),
      idle,
      "a redraw while idle moved the swayed ink",
    );
  } finally {
    await browser.close();
    server.close();
  }
});
