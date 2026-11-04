import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join } from "node:path";
import test from "node:test";
import { labExport } from "../../scripts/lib/built-export.ts";

/* THE FRAYED ENDS ON THE PAGE (DESIGN.md -> Thread -> The frayed ends, The drawing head): five fibres
   at the invite's top and at Wishes' close, and the same five riding the draw, never ahead of it.
   The model cannot show it — where the tip sits depends on the page's own scroll budget and the
   catch-up — so this runs the preview export, sway off (it re-shapes every path every frame). */

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

/* Per thread `<svg>` (the trunk, then Wishes' card): the end at rest's shown fibres, the tip's shown
   fibres and the far point of each, the head's shown runs, and where the cord ends — the one piece
   whose dash is partly drawn, read the way the head reads it. Points are in page pixels. */
const READ = `(() => {
  const shown = (el) => el !== null && el.style.display !== "none";
  const page = (svg, x, y) => {
    const m = svg.getScreenCTM();
    return { x: m.a * x + m.c * y + m.e + scrollX, y: m.b * x + m.d * y + m.f + scrollY };
  };
  return Array.from(document.querySelectorAll("svg[data-thread-svg]"))
    .filter((svg) => svg.querySelector("[data-thread-fray]"))
    .map((svg) => {
      const end = svg.querySelector("[data-thread-fray]");
      const tip = svg.querySelector("[data-thread-tip]");
      const head = svg.querySelector("[data-thread-head]");
      const tipEnds = shown(tip)
        ? Array.from(tip.querySelectorAll("path")).map((p) => {
            const n = (p.getAttribute("d").match(/-?\\d*\\.?\\d+/g) || []).map(Number);
            return page(svg, n[n.length - 2], n[n.length - 1]);
          })
        : [];
      let cordEnd = null;
      for (const p of svg.querySelectorAll("path[data-thread-piece]")) {
        const period = Number.parseFloat(p.style.strokeDasharray);
        const offset = Number.parseFloat(p.style.strokeDashoffset);
        if (!Number.isFinite(period) || !Number.isFinite(offset)) continue;
        const painted = Math.min(p.getTotalLength(), period - offset);
        if (painted > 0.5 && painted < p.getTotalLength() - 0.5) {
          const at = p.getPointAtLength(painted);
          cordEnd = page(svg, at.x, at.y);
        }
      }
      const pieces = svg.querySelectorAll("path[data-thread-piece]").length;
      return {
        pieces,
        endFibres: shown(end) ? end.querySelectorAll("path").length : 0,
        tipFibres: tipEnds.length,
        tipEnds,
        headShown: shown(head) ? Array.from(head.querySelectorAll("path")).filter(shown).length : 0,
        cordEnd,
      };
    })
    .sort((a, b) => b.pieces - a.pieces);
})()`;

type Thread = {
  pieces: number;
  endFibres: number;
  tipFibres: number;
  tipEnds: { x: number; y: number }[];
  headShown: number;
  cordEnd: { x: number; y: number } | null;
};

const BANDS = [
  { name: "tall", width: 393, height: 852 },
  { name: "upright", width: 834, height: 1112 },
  { name: "wide", width: 1536, height: 695 },
];

/* The fray reaches 2.7x the cord's width at most (`FRAY.reach` x 1.2); the cord is 2.2px. */
const FRAY_REACH = 2.7 * 1.2 * 2.2;

test("the ends are five fibres, the tip rides the draw and never leads it, and Wishes' end shows once the line is whole", async (t) => {
  if (!labExport(t)) return;
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ channel: "chromium" });
  const { server, port } = await serveExport();
  try {
    for (const band of BANDS) {
      const context = await browser.newContext({
        viewport: { width: band.width, height: band.height },
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      await page.addInitScript(SWAY_OFF);
      await page.goto(`http://localhost:${port}${LAB_ROUTE}`, {
        waitUntil: "load",
      });
      await page.waitForTimeout(3600);

      const [trunk] = (await page.evaluate(READ)) as Thread[];
      assert.equal(
        trunk.endFibres,
        5,
        `${band.name}: the invite's end shows ${trunk.endFibres} fibres`,
      );

      const maxScroll = (await page.evaluate(
        "document.documentElement.scrollHeight - window.innerHeight",
      )) as number;
      const restAt = maxScroll - 40;
      let tipSeen = 0;
      let tipsInCard = 0;
      for (let y = 0; y <= restAt; y += Math.max(80, restAt / 30)) {
        await page.evaluate(`window.scrollTo(0, ${y})`);
        await page.waitForTimeout(700);
        const threads = (await page.evaluate(READ)) as Thread[];
        const withTip = threads.filter((thread) => thread.tipFibres > 0);
        assert.ok(
          withTip.length <= 1,
          `${band.name} at ${Math.round(y)}: ${withTip.length} tips show at once`,
        );
        for (const thread of withTip) {
          tipSeen += 1;
          if (thread === threads[1]) tipsInCard += 1;
          assert.equal(thread.tipFibres, 5);
          assert.ok(
            thread.cordEnd !== null,
            `${band.name} at ${Math.round(y)}: a tip shows with no piece mid-draw in its own svg`,
          );
          const cordEnd = thread.cordEnd as { x: number; y: number };
          for (const end of thread.tipEnds) {
            const reach = Math.hypot(end.x - cordEnd.x, end.y - cordEnd.y);
            assert.ok(
              reach <= FRAY_REACH + 1,
              `${band.name} at ${Math.round(y)}: a fibre ends ${reach.toFixed(1)}px from the cord's end`,
            );
          }
        }
      }
      assert.ok(tipSeen > 0, `${band.name}: the tip never showed mid-draw`);

      await page.evaluate(`window.scrollTo(0, ${restAt})`);
      await page.waitForTimeout(2000);
      const rest = (await page.evaluate(READ)) as Thread[];
      assert.ok(
        rest.every(
          (thread) => thread.tipFibres === 0 && thread.headShown === 0,
        ),
        `${band.name}: the tip or the head still shows at rest with nothing left to draw`,
      );
      assert.equal(
        rest[1]?.endFibres,
        5,
        `${band.name}: Wishes' end shows ${rest[1]?.endFibres} fibres at rest`,
      );
      t.diagnostic(
        `${band.name}: tip seen ${tipSeen}x, ${tipsInCard}x in the card`,
      );
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
});

test("reduced motion shows both ends at rest and no tip", async (t) => {
  if (!labExport(t)) return;
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ channel: "chromium" });
  const { server, port } = await serveExport();
  try {
    const context = await browser.newContext({
      viewport: { width: 393, height: 852 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.goto(`http://localhost:${port}${LAB_ROUTE}`, {
      waitUntil: "load",
    });
    await page.waitForTimeout(1500);
    const threads = (await page.evaluate(READ)) as Thread[];
    assert.deepEqual(
      threads.map((thread) => [thread.endFibres, thread.tipFibres]),
      [
        [5, 0],
        [5, 0],
      ],
    );
  } finally {
    await browser.close();
    server.close();
  }
});
