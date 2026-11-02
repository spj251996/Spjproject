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
    };
  });
})()`;

type Reading = {
  dashed: number;
  unbroken: boolean;
  cut: number[];
  lastShown: number;
  shownCount: number;
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
