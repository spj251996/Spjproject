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

/* THE DRAWING HEAD MUST BE GONE ONCE THERE IS NOTHING LEFT TO DRAW — the owner's rule, reported
   twice (2026-10-03 and again 2026-10-05 with a screenshot of the head sitting on Wishes' closing
   taper), and until now guarded by nothing.

   It cannot be tested from the model. `headSegments` returning `[]` is necessary but nowhere near
   sufficient: what the owner sees depends on the drawn length actually REACHING every piece's end at
   a resting scroll position, which is a property of the page's scroll budget
   (`--thread-terminal-finish`) and of the follower that eases toward it (`--thread-catchup`) — and
   the follower is exactly where this broke, because an exponential never arrives and left the weave
   99.69% drawn with the head lit (`page-thread.tsx` -> `createCatchUp`). So this runs a real page.

   THE MID-DRAW ASSERTION IS NOT DECORATION. A test that only checked "no head at the end" would pass
   just as well if the head never rendered at all, which is the vacuous shape this project has already
   shipped once (`lessons.md` -> Verification). Each band must show the head WHILE drawing before its
   absence at the end means anything.

   The head is retired by hiding its GROUP, not by hiding each path, so that is what is asserted —
   counting path `display` alone reads a hidden group as lit, a reader error that briefly produced a
   false failure while this round was being measured. */

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

/* `headShown` counts only groups that are themselves displayed; `taperShown` is the closing taper's
   own runs, which the head covers when it fails to retire — the owner's actual complaint was that
   they could not SEE the taper, so it is asserted directly rather than inferred from the head. */
const READ = `(() => {
  const shown = (selector) => Array.from(document.querySelectorAll(selector))
    .filter((g) => g.style.display !== "none")
    .reduce((total, g) => total + Array.from(g.querySelectorAll("path")).filter((p) => p.style.display !== "none").length, 0);
  const pieces = Array.from(document.querySelectorAll("path[data-thread-piece]"));
  return {
    headShown: shown("[data-thread-head]"),
    taperShown: shown("[data-thread-taper]"),
    pieces: pieces.length,
    undrawn: pieces.filter((p) => {
      const period = Number.parseFloat(p.style.strokeDasharray);
      const offset = Number.parseFloat(p.style.strokeDashoffset);
      return Number.isFinite(period) && Number.isFinite(offset) && offset > 0.5;
    }).length,
  };
})()`;

const BANDS = [
  { name: "tall", width: 393, height: 852 },
  { name: "upright", width: 834, height: 1112 },
  { name: "wide", width: 1536, height: 695 },
];

test("the drawing head is lit while drawing and gone once the whole thread is drawn", async (t) => {
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
    for (const band of BANDS) {
      const context = await browser.newContext({
        viewport: { width: band.width, height: band.height },
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      await page.goto(`http://localhost:${port}${LAB_ROUTE}`, {
        waitUntil: "load",
      });
      /* The opening sequence hands off at 2200ms and its own draw runs 1200ms beyond that. */
      await page.waitForTimeout(3600);

      const maxScroll = (await page.evaluate(
        "document.documentElement.scrollHeight - window.innerHeight",
      )) as number;
      /* THE RESTING POSITION IS THE WHOLE POINT, AND IT IS DELIBERATELY NOT THE PAGE'S LAST PIXEL.
         At the exact bottom the thread completes whatever `--thread-terminal-finish` is set to, so a
         test that only looked there would pass with the token at 0 and guard nothing. A reader comes
         to rest a little short — which is the state the owner screenshotted — and the token exists to
         make the stretch finish before that. 40px is inside the tolerance 0.08 buys at every band
         (~56px `wide`, ~68px `tall`, ~89px `upright`).
         This page must never REACH the bottom: the ratchet never un-draws, so touching it once would
         leave the thread complete for every later reading and mask exactly the regression at issue. */
      const restAt = maxScroll - 40;
      let headSeenMidDraw = 0;
      for (let y = 0; y <= restAt; y += Math.max(80, restAt / 25)) {
        await page.evaluate(`window.scrollTo(0, ${y})`);
        await page.waitForTimeout(40);
        const mid = (await page.evaluate(READ)) as { headShown: number };
        headSeenMidDraw = Math.max(headSeenMidDraw, mid.headShown);
      }
      assert.ok(
        headSeenMidDraw > 0,
        `${band.name}: the head never painted at any scroll position, so its absence at the end proves nothing`,
      );

      await page.evaluate(`window.scrollTo(0, ${restAt})`);
      /* Past the catch-up's own duration with room to spare, so this measures where the draw SETTLES
         rather than racing the follower. */
      await page.waitForTimeout(2000);
      const rest = (await page.evaluate(READ)) as {
        headShown: number;
        taperShown: number;
        pieces: number;
        undrawn: number;
      };

      assert.equal(
        rest.undrawn,
        0,
        `${band.name}: ${rest.undrawn} of ${rest.pieces} pieces are still part-drawn at rest, 40px short of the bottom`,
      );
      assert.equal(
        rest.headShown,
        0,
        `${band.name}: the drawing head is still showing ${rest.headShown} runs at rest, 40px short of the bottom, with nothing left to draw`,
      );
      assert.ok(
        rest.taperShown > 0,
        `${band.name}: the closing taper is not visible at rest`,
      );
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
});
