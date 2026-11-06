import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join } from "node:path";
import test from "node:test";
import type { Page } from "playwright";
import { labExport } from "../../scripts/lib/built-export.ts";

/* THE THREAD'S ENTRANCE ON THE PAGE (DESIGN.md -> Motion -> The thread's entrance): the fibres arrive and spin into
   the thread, the timed draw carries on with no pause, and nothing of the entrance is left once it lands; a scroll,
   a re-measure, a hidden tab or reduced motion cut it short. The scene's own tests cover its geometry; this runs the
   preview export, sway off (it re-shapes every path every frame). */

const LAB_ROUTE = "/thread.html";
const PHONE = { width: 393, height: 700 };
const ENTRANCE = "[data-thread-entrance]";

const SWAY_OFF = `(() => {
  const off = () => {
    if (!document.documentElement) return false;
    document.documentElement.dataset.threadSway = "off";
    return true;
  };
  if (!off()) new MutationObserver((_, watcher) => off() && watcher.disconnect()).observe(document, { childList: true });
})()`;

/* Every animation frame from load: whether anything of the line moved since the last one (the entrance's paths, or
   any trunk piece's dash — the timed draw runs on past the invite's piece), how far the invite piece has drawn, and
   whether the entrance is on the page. */
const RECORD = `(() => {
  const frames = (window.__entranceFrames = []);
  let last = "";
  const step = (now) => {
    const group = document.querySelector("${ENTRANCE}");
    const piece = document.querySelector("svg[data-thread-svg][class*='pageRoot'] path[data-thread-piece]");
    let ink = 0;
    if (piece) {
      const period = Number.parseFloat(piece.style.strokeDasharray);
      const offset = Number.parseFloat(piece.style.strokeDashoffset);
      ink = Number.isFinite(period) && Number.isFinite(offset) ? Math.max(0, period - offset) : piece.style.strokeDasharray === "" ? Infinity : 0;
    }
    const lines = group ? Array.from(group.querySelectorAll("path"), (p) => p.getAttribute("d") ?? "").join("|") : "";
    /* The line's leading front along the invite's piece: its own ink, or the entrance cord's head once that is on the
       piece (within 3px of it), whichever is further. Sampled every 2px on first use. */
    let front = ink === Infinity ? 0 : ink;
    if (piece && group) {
      window.__pieceSamples ??= Array.from({ length: Math.ceil(piece.getTotalLength() / 2) }, (_, i) => piece.getPointAtLength(i * 2));
      const cord = group.querySelector(":scope > path");
      const n = (cord?.getAttribute("d") ?? "").match(/-?[\\d.]+/g);
      if (n && n.length >= 2) {
        const hx = Number(n[n.length - 2]);
        const hy = Number(n[n.length - 1]);
        let best = Infinity, at = 0;
        window.__pieceSamples.forEach((p, i) => { const d = Math.hypot(p.x - hx, p.y - hy); if (d < best) { best = d; at = i * 2; } });
        if (best <= 3) front = Math.max(front, at);
      }
    }
    const dashes = Array.from(document.querySelectorAll("svg[data-thread-svg][class*='pageRoot'] path[data-thread-piece]"), (p) => p.style.strokeDashoffset).join(",");
    const state = lines + "#" + dashes;
    const fibres = group ? Array.from(group.querySelectorAll("g[filter*='fibre'] path")).filter((p) => (p.getAttribute("d") ?? "") !== "") : [];
    frames.push({
      now,
      entrance: group !== null,
      fibres: fibres.length,
      longest: Math.max(0, ...fibres.map((p) => p.getTotalLength())),
      moved: state !== last,
      ink,
      front,
      height: innerHeight,
      viewBox: document.querySelector("svg[data-thread-svg][class*='pageRoot']:has(path[data-thread-piece])")?.getAttribute("viewBox") ?? "",
      opened: document.querySelector("[data-thread-opened]") !== null,
    });
    last = state;
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
})()`;

type Frame = {
  now: number;
  entrance: boolean;
  fibres: number;
  longest: number;
  moved: boolean;
  ink: number;
  front: number;
  height: number;
  viewBox: string;
  opened: boolean;
};

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

/* Every main-trunk piece undashed: drawn whole, as reduced motion paints it. */
const ALL_UNDASHED = `Array.from(document.querySelectorAll("svg[data-thread-svg] path[data-thread-piece]")).every((p) => p.style.strokeDasharray === "")`;

async function withPage(
  options: {
    reducedMotion?: "reduce" | "no-preference";
    sway?: boolean;
    viewport?: { width: number; height: number };
  },
  run: (page: Page) => Promise<void>,
  prepare?: (page: Page) => Promise<void>,
) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ channel: "chromium" });
  const { server, port } = await serveExport();
  try {
    const context = await browser.newContext({
      viewport: options.viewport ?? PHONE,
      deviceScaleFactor: 1,
      reducedMotion: options.reducedMotion ?? "no-preference",
    });
    const page = await context.newPage();
    if (!options.sway) await page.addInitScript(SWAY_OFF);
    await page.addInitScript(RECORD);
    await prepare?.(page);
    await page.goto(`http://localhost:${port}${LAB_ROUTE}`, {
      waitUntil: "load",
    });
    await run(page);
  } finally {
    await browser.close();
    server.close();
  }
}

/* In flight: once the first fibre is drawn (before the type lands the entrance paints nothing), and a moment on,
   with the bundle still on its way. */
async function midEntrance(page: Page) {
  await page.waitForFunction(
    "window.__entranceFrames.some((frame) => frame.fibres > 0)",
    null,
    { timeout: 15000 },
  );
  await page.waitForTimeout(300);
  const [last] = await framesSince(page, (await frameCount(page)) - 1);
  assert.ok(last.entrance && last.fibres > 0, "the entrance was not in flight");
}

async function framesSince(page: Page, from: number) {
  const frames = (await page.evaluate("window.__entranceFrames")) as Frame[];
  return frames.slice(from);
}

async function frameCount(page: Page) {
  return (await page.evaluate("window.__entranceFrames.length")) as number;
}

/* The owner's complaint on every early round was a pause: the line stopping between the bundle's arrival and the
   draw carrying on. So from the first fibre to the draw's landing something moves on every frame (a held frame or
   two is the compositor, not the thread), the drawn ink never goes back, and nothing is left at the end. */
test("the entrance plays and leaves nothing", async (t) => {
  if (!labExport(t)) return;
  await withPage({}, async (page) => {
    await page.waitForSelector("[data-thread-opened]", {
      state: "attached",
      timeout: 15000,
    });
    await page.waitForTimeout(200);
    const frames = await framesSince(page, 0);
    const first = frames.findIndex((frame) => frame.fibres > 0);
    const opened = frames.findIndex((frame) => frame.opened);
    assert.ok(first >= 0, "no fibre was ever drawn");
    assert.ok(opened > first, "the draw landed before the entrance began");

    let held = 0;
    let longest = 0;
    let at = first;
    for (let i = first + 1; i < opened; i++) {
      held = frames[i].moved ? 0 : held + 1;
      if (held > longest) {
        longest = held;
        at = i;
      }
    }
    assert.ok(
      longest <= 2,
      `the line held still for ${longest} frames, ending ${Math.round(frames[at].now - frames[first].now)}ms after the first fibre (entrance ${frames[at].entrance ? "on" : "gone"}, ink ${frames[at].ink.toFixed(1)})`,
    );
    for (let i = first + 1; i < frames.length; i++)
      assert.ok(
        frames[i].ink >= frames[i - 1].ink - 0.01,
        `the invite's ink went back at frame ${i}: ${frames[i - 1].ink} -> ${frames[i].ink}`,
      );

    assert.equal(
      await page.$(ENTRANCE),
      null,
      "the entrance is still on the page",
    );
    /* An SVG group's computed display is `inline`; the fray is hidden with `none`. */
    assert.notEqual(
      (await page.evaluate(
        `getComputedStyle(document.querySelector("svg[data-thread-svg][class*='pageRoot'] [data-thread-fray]")).display`,
      )) as string,
      "none",
      "the thread's own frayed end is not shown at rest",
    );
  });
});

/* A cut is immediate: within two frames the entrance is gone, and the timed draw it was bringing carries on. */
/* Counted in frames, never milliseconds: under the suite's parallel browsers a frame can take hundreds. */
async function assertCutShort(page: Page, from: number, what: string) {
  await page.waitForFunction(
    `window.__entranceFrames.length >= ${from + 3}`,
    null,
    { timeout: 10000 },
  );
  const frames = await framesSince(page, from);
  const gone = frames.findIndex((frame) => !frame.entrance);
  assert.ok(
    gone >= 0 && gone <= 2,
    `${what}: the entrance stayed ${gone < 0 ? frames.length : gone} frames`,
  );
}

test("a scroll cuts it short", async (t) => {
  if (!labExport(t)) return;
  await withPage({}, async (page) => {
    await midEntrance(page);
    const from = await frameCount(page);
    await page.evaluate("window.scrollBy(0, 200)");
    await assertCutShort(page, from, "a scroll");
    await page.waitForTimeout(3000);
    const [last] = (await framesSince(
      page,
      (await frameCount(page)) - 1,
    )) as Frame[];
    assert.ok(last.ink > 120, `the invite's piece drew only ${last.ink}px`);
  });
});

test("a resize cuts it short", async (t) => {
  if (!labExport(t)) return;
  await withPage({}, async (page) => {
    await midEntrance(page);
    const before = await frameCount(page);
    const viewBox = (await framesSince(page, before - 1))[0].viewBox;
    /* A width change: a height-only resize takes the page's cheap path, which re-measures nothing and leaves the
       entrance running, as it should — the fibres come from the top-left, which a taller window does not move. */
    await page.setViewportSize({ width: 430, height: PHONE.height });
    /* A resize re-measures through `useLayoutTriggers`' debounce (`thread-measure.ts`), and the re-measure, which
       rewrites the thread's viewBox, is what ends the entrance: gone by the first frame that shows it. */
    await page.waitForFunction(
      `window.__entranceFrames.slice(${before}).some((frame) => frame.viewBox !== ${JSON.stringify(viewBox)})`,
      null,
      { timeout: 10000 },
    );
    const frames = await framesSince(page, before);
    const remeasured = frames.findIndex((frame) => frame.viewBox !== viewBox);
    assert.ok(
      !frames[remeasured].entrance,
      "the entrance outlived the re-measure",
    );
  });
});

test("a hidden tab cuts it short", async (t) => {
  if (!labExport(t)) return;
  await withPage({}, async (page) => {
    await midEntrance(page);
    await page.evaluate(`(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
    })()`);
    assert.equal(
      await page.$(ENTRANCE),
      null,
      "a hidden tab left the entrance",
    );
  });
});

test("reduced motion runs no entrance", async (t) => {
  if (!labExport(t)) return;
  await withPage({ reducedMotion: "reduce" }, async (page) => {
    await page.waitForTimeout(4000);
    const frames = await framesSince(page, 0);
    assert.ok(
      frames.every((frame) => !frame.entrance),
      "an entrance ran under reduced motion",
    );
    assert.ok(await page.evaluate(ALL_UNDASHED), "a piece is still dashed");
  });
});

test("reduced motion switched on mid-entrance ends it", async (t) => {
  if (!labExport(t)) return;
  await withPage({}, async (page) => {
    await midEntrance(page);
    const from = await frameCount(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await assertCutShort(page, from, "reduced motion");
    assert.ok(await page.evaluate(ALL_UNDASHED), "a piece is still dashed");
  });
});

/* A page whose script arrives after the type has landed plays the entrance in full rather than catching up: its
   first frame is the scene's first, with no fibre yet in flight. Fast-forwarded, the frame would open mid-scene. */
test("a late start plays in full", async (t) => {
  if (!labExport(t)) return;
  await withPage(
    {},
    async (page) => {
      await page.waitForFunction(
        "window.__entranceFrames.some((frame) => frame.entrance)",
        null,
        { timeout: 15000 },
      );
      const first = (await framesSince(page, 0)).find(
        (frame) => frame.entrance,
      );
      assert.ok(first, "the entrance never painted a frame");
      assert.equal(
        first.fibres,
        0,
        "a fibre was already in flight on the entrance's first frame",
      );
      /* And it plays: a start fast-forwarded past the landing ends at once with nothing drawn. */
      await page.waitForFunction(
        "window.__entranceFrames.some((frame) => frame.fibres > 0)",
        null,
        { timeout: 10000 },
      );
    },
    async (page) => {
      await page.route("**/_next/static/chunks/**/*.js", async (route) => {
        /* Long enough that the script runs well after the type has landed at 1800ms. */
        await new Promise((resolve) => setTimeout(resolve, 4000));
        await route.continue();
      });
    },
  );
});

/* The entrance draws inside the page thread's svg, whose sway displaces every path it is given. The spike drew in an
   overlay with no sway, and that is what the owner signed off: the painter's one write per path per frame must be
   the only one. */
test("the sway leaves the entrance alone", async (t) => {
  if (!labExport(t)) return;
  await withPage(
    { sway: true },
    async (page) => {
      await page.waitForFunction(
        "window.__entranceFrames.some((frame) => frame.fibres > 0)",
        null,
        { timeout: 15000 },
      );
      await page.waitForTimeout(800);
      const most = (await page.evaluate(
        "window.__entranceMostWrites",
      )) as number;
      assert.ok(most >= 1, "no write to the entrance's paths was seen");
      assert.equal(
        most,
        1,
        `an entrance path was written ${most} times in one frame — the sway reshaped it`,
      );
    },
    async (page) => {
      await page.addInitScript(`(() => {
        let writes = new Map();
        window.__entranceMostWrites = 0;
        new MutationObserver((records) => {
          for (const record of records) {
            const target = record.target;
            if (record.attributeName !== "d" || !target.closest?.("[data-thread-entrance]")) continue;
            const count = (writes.get(target) ?? 0) + 1;
            writes.set(target, count);
            window.__entranceMostWrites = Math.max(window.__entranceMostWrites, count);
          }
        }).observe(document, { subtree: true, attributes: true, attributeFilter: ["d"] });
        const frame = () => { writes = new Map(); requestAnimationFrame(frame); };
        requestAnimationFrame(frame);
      })()`);
    },
  );
});

/* Under long frames the timed draw must still start where the scene meant it to, or it trails the entrance's cord for
   its whole run and the line steps back when the cord is cleared at the landing. */
test("under long frames the line never steps back at the landing", async (t) => {
  if (!labExport(t)) return;
  await withPage(
    { viewport: { width: 820, height: 1180 } },
    async (page) => {
      await page.waitForSelector("[data-thread-opened]", {
        state: "attached",
        timeout: 30000,
      });
      const frames = await framesSince(page, 0);
      const last = frames.findLastIndex((frame) => frame.entrance);
      assert.ok(last >= 0, "no entrance ran");
      const before = Math.max(
        ...frames.slice(Math.max(0, last - 2), last + 1).map((f) => f.front),
      );
      assert.ok(
        before > 0,
        "the entrance's cord never reached the invite's piece",
      );
      const after = frames[last + 1].front;
      assert.ok(
        after >= before - 2,
        `the line stepped back ${(before - after).toFixed(1)}px at the landing`,
      );
    },
    /* From the first fibre on, every frame takes ~100ms: a busy phone. */
    async (page) => {
      await page.addInitScript(`(() => {
        const slow = () => {
          if (document.querySelector("[data-thread-entrance] path[d^='M']")) {
            const until = performance.now() + 90;
            while (performance.now() < until);
          }
          requestAnimationFrame(slow);
        };
        requestAnimationFrame(slow);
      })()`);
    },
  );
});
