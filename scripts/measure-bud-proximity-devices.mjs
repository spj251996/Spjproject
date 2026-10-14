/* THE SWEEP WAS A CROSS PRODUCT, NOT A DEVICE LIST — 7 widths x 4 heights, so 430x568 pairs a
   Pro Max's width with an iPhone SE's height, which no handset presents. This runs the bud metric
   at REAL viewports: each phone's full layout viewport, and the shorter one it actually shows with
   the browser's URL bar visible, which is the state a reader is in most of the time. */
import { chromium } from "playwright";
import sharp from "sharp";

/* The chamfer transform's diagonal step. Written as the constant rather than the 1.414 the
   classic 3x3 kernel uses: the approximation was chosen for integer-ish speed on hardware that
   is not this, and at the radii this measures (a bud is ink whose largest inscribed disc is
   >=3px) the difference is below the pixel the answer is read in either way. */
const DIAGONAL = Math.SQRT2;

const DIFF = 6,
  PAD = 46,
  BUD_R = 3;

const DEVICES = [
  ["iPhone SE 2/3, iPhone 8", 375, 667, 553],
  ["iPhone 13 mini", 375, 812, 629],
  ["iPhone 12/13/14, 16e", 390, 844, 659],
  ["iPhone 14 Pro, 15, 16", 393, 852, 667],
  ["iPhone 15/16 Pro Max", 430, 932, 747],
  ["iPhone 16 Pro Max", 440, 956, 771],
  ["Galaxy S21/S22/S23", 360, 800, 650],
  ["Galaxy S23 Ultra", 384, 854, 700],
  ["Pixel 7/8", 412, 915, 750],
  ["small Android", 360, 640, 500],
];

const browser = await chromium.launch({ channel: "chromium" });
const page = await browser.newPage();
const probe = (css) =>
  page.evaluate((t) => {
    let el = document.getElementById("probe-style");
    if (!el) {
      el = document.createElement("style");
      el.id = "probe-style";
      document.head.append(el);
    }
    el.textContent = t;
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
function dt(m, W, H) {
  const z = new Float64Array(W * H);
  for (let p = 0; p < W * H; p++) z[p] = m[p] ? 1e9 : 0;
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : z[y * W + x]);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      if (!m[p]) continue;
      z[p] = Math.min(
        z[p],
        at(x - 1, y) + 1,
        at(x, y - 1) + 1,
        at(x - 1, y - 1) + DIAGONAL,
        at(x + 1, y - 1) + DIAGONAL,
      );
    }
  for (let y = H - 1; y >= 0; y--)
    for (let x = W - 1; x >= 0; x--) {
      const p = y * W + x;
      if (!m[p]) continue;
      z[p] = Math.min(
        z[p],
        at(x + 1, y) + 1,
        at(x, y + 1) + 1,
        at(x + 1, y + 1) + DIAGONAL,
        at(x - 1, y + 1) + DIAGONAL,
      );
    }
  return z;
}
function comps(m, W, H) {
  const seen = new Uint8Array(W * H),
    out = [];
  for (let p = 0; p < W * H; p++) {
    if (!m[p] || seen[p]) continue;
    const st = [p];
    seen[p] = 1;
    const px = [];
    while (st.length) {
      const q = st.pop();
      px.push(q);
      const x = q % W,
        y = (q / W) | 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx,
            ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const r = ny * W + nx;
          if (m[r] && !seen[r]) {
            seen[r] = 1;
            st.push(r);
          }
        }
    }
    out.push(px);
  }
  return out;
}

async function budGap(w, h) {
  await page.setViewportSize({ width: w, height: h });
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
  await probe("[data-invite-stack] .type-eyebrow{visibility:hidden!important}");
  const blooms = await raw(clip);
  const { width: W, height: H } = ground.info;
  const glyph = [];
  for (let p = 0; p < W * H; p++)
    if (d(type.data, ground.data, p * 3)) glyph.push([p % W, (p / W) | 0]);
  const bloom = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++)
    if (d(blooms.data, ground.data, p * 3)) bloom[p] = 1;
  const dist = dt(bloom, W, H);
  const core = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) if (dist[p] >= BUD_R) core[p] = 1;
  let best = Infinity,
    side = "-";
  for (const bud of comps(core, W, H)) {
    const R = Math.max(...bud.map((p) => dist[p]));
    for (const q of bud) {
      const bx = q % W,
        by = (q / W) | 0;
      for (const [gx, gy] of glyph) {
        const g = Math.hypot(bx - gx, by - gy) - R;
        if (g < best) {
          best = g;
          side = by < gy ? "above" : "below";
        }
      }
    }
  }
  return best === Infinity
    ? { gap: null }
    : { gap: Math.max(0, +best.toFixed(1)), side };
}

console.log(
  "y: -18.4 — nearest BUD to the eyebrow, at real device viewports\n",
);
console.log(
  "device                      viewport      full page    with URL bar",
);
for (const [name, w, full, visible] of DEVICES) {
  const a = await budGap(w, full);
  const b = await budGap(w, visible);
  const f = (r) => (r.gap === null ? "no bud" : `${r.gap}px ${r.side}`);
  const warn = (r) => (r.gap !== null && r.gap <= 12 ? " <--" : "");
  console.log(
    `${name.padEnd(26)}  ${String(w).padStart(3)}px      ${(`${full}: ${f(a)}`).padEnd(20)}${warn(a)}  ${visible}: ${f(b)}${warn(b)}`,
  );
}
await browser.close();
