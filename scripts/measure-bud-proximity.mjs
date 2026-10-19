/* A BOUNDING BOX CANNOT MEASURE THICKNESS — the first version of this called a 20x88 component a
   "bud" because a wavy stem with leaves fills a wide box while the ink stays 2px across. The
   thickness of ink is the radius of the largest disc that fits inside it, so: a chamfer distance
   transform over the bloom mask, and a BUD is a core of pixels whose inscribed radius clears a
   stem's. Measured from the bud CORE outward, never from the component it hangs off, or the
   attached stem's own distance is reported as the bud's. */
import { chromium } from "playwright";
import sharp from "sharp";

const DIAGONAL = Math.SQRT2;

const VIEWPORTS = [
  [430, 667],
  [412, 667],
  [393, 667],
  [390, 667],
  [375, 667],
  [360, 667],
  [320, 667],
  [430, 568],
  [430, 844],
];
/* The invite's top-right piece and the `top` values (vw) swept for it. */
const PIECE = "corner-trail";
const VALUES = [0];
const DIFF = 6;
const PAD = 40;
const BUD_R = 3; // inscribed radius in px: >= 3 means >= ~6px of solid ink across
const NEAR = 12; // px of clear gap below which a bud reads as crowding the line

const browser = await chromium.launch({ channel: "chromium" });
const page = await browser.newPage();
const probe = (css) =>
  page.evaluate((text) => {
    let el = document.getElementById("probe-style");
    if (!el) {
      el = document.createElement("style");
      el.id = "probe-style";
      document.head.append(el);
    }
    el.textContent = text;
  }, css);
const raw = async (clip) =>
  sharp(await page.screenshot({ clip }))
    .flatten({ background: "#fff" })
    .raw()
    .toBuffer({ resolveWithObject: true });
const d = (a, b, i) =>
  Math.abs(a[i] - b[i]) > DIFF ||
  Math.abs(a[i + 1] - b[i + 1]) > DIFF ||
  Math.abs(a[i + 2] - b[i + 2]) > DIFF;

/* Two-pass 8-neighbour chamfer: weight 1 for orthogonal steps, SQRT2 for diagonal. */
function distanceTransform(mask, W, H) {
  const INF = 1e9;
  const dist = new Float64Array(W * H);
  for (let p = 0; p < W * H; p++) dist[p] = mask[p] ? INF : 0;
  const at = (x, y) =>
    x < 0 || y < 0 || x >= W || y >= H ? 0 : dist[y * W + x];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      if (!mask[p]) continue;
      dist[p] = Math.min(
        dist[p],
        at(x - 1, y) + 1,
        at(x, y - 1) + 1,
        at(x - 1, y - 1) + DIAGONAL,
        at(x + 1, y - 1) + DIAGONAL,
      );
    }
  for (let y = H - 1; y >= 0; y--)
    for (let x = W - 1; x >= 0; x--) {
      const p = y * W + x;
      if (!mask[p]) continue;
      dist[p] = Math.min(
        dist[p],
        at(x + 1, y) + 1,
        at(x, y + 1) + 1,
        at(x + 1, y + 1) + DIAGONAL,
        at(x - 1, y + 1) + DIAGONAL,
      );
    }
  return dist;
}
function components(mask, W, H) {
  const seen = new Uint8Array(W * H);
  const out = [];
  for (let p = 0; p < W * H; p++) {
    if (!mask[p] || seen[p]) continue;
    const stack = [p];
    seen[p] = 1;
    const px = [];
    while (stack.length) {
      const q = stack.pop();
      px.push(q);
      const x = q % W,
        y = (q / W) | 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx,
            ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const r = ny * W + nx;
          if (mask[r] && !seen[r]) {
            seen[r] = 1;
            stack.push(r);
          }
        }
    }
    out.push(px);
  }
  return out;
}

const rows = [];
for (const [vw, vh] of VIEWPORTS) {
  await page.setViewportSize({ width: vw, height: vh });
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(
    () => {
      const el = document.querySelector("[data-invite-stack]");
      return el && Number(getComputedStyle(el).opacity) === 1;
    },
    null,
    { timeout: 10000 },
  );
  const clip = await page.evaluate((pad) => {
    const r = document
      .querySelector("[data-invite-stack] .type-eyebrow")
      .getBoundingClientRect();
    return {
      x: Math.floor(r.x) - 10,
      y: Math.floor(r.y) - pad,
      width: Math.ceil(r.width) + 20,
      height: Math.ceil(r.height) + pad * 2,
    };
  }, PAD);

  await probe("#invite .botanical-piece{visibility:hidden!important}");
  const type = await raw(clip);
  await probe(
    "#invite .botanical-piece{visibility:hidden!important}[data-invite-stack] .type-eyebrow{visibility:hidden!important}",
  );
  const ground = await raw(clip);
  const { width: W, height: H } = ground.info;
  const glyphPx = [];
  for (let p = 0; p < W * H; p++)
    if (d(type.data, ground.data, p * 3)) glyphPx.push([p % W, (p / W) | 0]);

  for (const y of VALUES) {
    await probe(
      `[data-invite-stack] .type-eyebrow{visibility:hidden!important}` +
        `#invite .botanical-piece--${PIECE}{top:${y}vw !important}`,
    );
    const blooms = await raw(clip);
    const bloom = new Uint8Array(W * H);
    for (let p = 0; p < W * H; p++)
      if (d(blooms.data, ground.data, p * 3)) bloom[p] = 1;

    const dist = distanceTransform(bloom, W, H);
    const core = new Uint8Array(W * H);
    for (let p = 0; p < W * H; p++) if (dist[p] >= BUD_R) core[p] = 1;

    let best = null;
    for (const budPx of components(core, W, H)) {
      const R = Math.max(...budPx.map((p) => dist[p]));
      let gap = Infinity,
        side = "-",
        cx = 0,
        cy = 0;
      for (const q of budPx) {
        const bx = q % W,
          by = (q / W) | 0;
        for (const [gx, gy] of glyphPx) {
          const g = Math.hypot(bx - gx, by - gy) - R;
          if (g < gap) {
            gap = g;
            side = by < gy ? "above" : "below";
            cx = bx;
            cy = by;
          }
        }
      }
      if (!best || gap < best.gap)
        best = {
          gap: Math.max(0, +gap.toFixed(1)),
          R: +R.toFixed(1),
          side,
          cx,
          cy,
        };
    }
    rows.push({
      vw,
      vh,
      y,
      buds: components(core, W, H).length,
      ...(best ?? { gap: null, R: null, side: "-" }),
    });
  }
}
await browser.close();

console.log(
  "viewport     y       buds   bud radius   clear gap to glyph   side",
);
for (const r of rows) {
  const flag = r.gap !== null && r.gap <= NEAR ? "   <-- CROWDS THE LINE" : "";
  console.log(
    `${String(r.vw)}x${String(r.vh).padEnd(4)}  ${String(r.y).padStart(6)}  ${String(r.buds).padStart(5)}   ${String(r.R ?? "-").padStart(10)}   ${String(r.gap ?? "no bud").padStart(18)}   ${r.side}${flag}`,
  );
}
