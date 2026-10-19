/* Builds public/og-card.jpg's source — the 1200x630 link-preview card — from the running dev
 * server. Nothing under app/ is touched.
 *
 * The card is the invite distilled on its own ground: the invite's ground and
 * both of its flowers, the couple's drawn names on one line, the sprig divider, and the two dates in
 * `date-label`'s style. DESIGN.md -> Domain Components -> Link Preview Card is the contract.
 *
 * METHOD:
 *   1. Fetch the page. LIFT the next/font variable classes, the invite's names `<h1>`, the invite's
 *      `ornamental-divider`, every symbol `<defs>` block (the sprig AND the names — a `<use>`
 *      resolves against its own document, so without them the names render as nothing), and both
 *      events' dates from Event Info. Strings are lifted, never re-derived: re-implementing the
 *      date format would be a second implementation free to drift from the one the site ships.
 *   2. Fetch every linked stylesheet and every font file it references into tmp/og-card/, so the
 *      card is one origin and the @font-face requests are not cross-origin.
 *   3. Copy the two pieces' desktop images in beside the html. The src is RELATIVE: the page is
 *      opened over file://, where an absolute /botanical/... would resolve to the filesystem root.
 *   4. Write tmp/og-card/card.html, screenshot the .og-card element, step JPEG quality down to the
 *      size budget.
 *
 * ENGINE PIN (mandatory): chromium.launch({ channel: "chromium" }). The default launch reaches for
 * Chromium's old headless_shell, which quantises glyph advances — text renders about 3% wider.
 *
 * OUTPUT is tmp/ by default, deliberately: a generated file is written to tmp/, diffed, then copied
 * in. Pass --out to place it.
 *
 * USAGE:
 *   node scripts/build-og-card.mjs                        # -> tmp/og-card/og-card.jpg
 *   node scripts/build-og-card.mjs --out assets/og/og-card.jpg
 *   node scripts/build-og-card.mjs --names 84 --flowers 1 --dates 24 --out tmp/og-card/a.jpg
 */

import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import sharp from "sharp";
import { TUNING } from "../components/background/botanical-tuning.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WORK = join(ROOT, "tmp", "og-card");

/**
 * @typedef {{
 *   width: number,
 *   height: number,
 *   names: number,
 *   dates: number,
 *   flowers: number,
 *   sprayDrop: number,
 *   gapDivider: number,
 *   gapDates: number,
 *   maxKb: number,
 * }} Card
 */

/* Every value the card sets, in one place, each picked on a render. */
export const CARD = /** @type {Readonly<Card>} */ (
  Object.freeze({
    width: 1200,
    height: 630,
    /* `--text-display-name`: the drawn names' width is `em` of it, so this IS their size. */
    names: 124,
    /* `date-label`'s size on the card, and its line height. */
    dates: 24,
    /* The flowers at their desktop share of the page's width, times this. */
    flowers: 1.65,
    /* How far the bottom-left piece sits below the card's lower edge, so its longest stem clears the
     date line by about 10px. Its overhang is clipped. */
    sprayDrop: 60,
    gapDivider: 20,
    gapDates: 20,
    maxKb: 400,
  })
);

/* Each piece at its desktop tier, as a share of the window's width: `botanical-tuning.ts`'s desktop
   `size` (vw). */
export const PIECES = Object.freeze([
  {
    piece: "corner-trail",
    share: TUNING["corner-trail"].desktop.size / 100,
    place: () => "top: 0; right: 0;",
  },
  {
    piece: "corner-spray",
    share: TUNING["corner-spray"].desktop.size / 100,
    /** @param {Card} card */
    place: (card) => `bottom: ${-card.sprayDrop}px; left: 0;`,
  },
]);

/* The font files the compiled CSS points at, relative to its own `../media/`. NONE is a failure, not a
   quiet card: the dates would render in a fallback face, the names are SVG and pass every check, and
   `document.fonts.ready` resolves on a failed face too — so a changed URL form ships a wrong card. */
/** @param {string} css */
export function mediaFiles(css) {
  const files = new Set(
    [...css.matchAll(/url\(["']?\.\.\/media\/([^"')]+)["']?\)/g)].map(
      (m) => m[1],
    ),
  );
  if (files.size === 0) {
    throw new Error(
      "no font files referenced as ../media/ in the CSS — the URL form changed",
    );
  }
  return files;
}

/* The size flags, each a finite number: a typo must stop the run, not draw `width: NaNpx` flowers that
   still pass the image-loaded wait. Sizes are positive; the spray's drop may be zero. */
/**
 * @param {string[]} argv
 * @returns {Record<string, number>}
 */
export function parseOverrides(argv) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const key of ["names", "dates", "flowers", "sprayDrop"]) {
    const i = argv.indexOf(`--${key}`);
    if (i === -1) continue;
    const value = Number(argv[i + 1]);
    const ok =
      Number.isFinite(value) && (key === "sprayDrop" ? value >= 0 : value > 0);
    if (!ok)
      throw new Error(
        `--${key} must be a ${key === "sprayDrop" ? "non-negative" : "positive"} number, got "${argv[i + 1]}"`,
      );
    out[key] = value;
  }
  return out;
}

const QUALITY_STEPS = [95, 92, 90, 88, 85, 82, 80, 76, 72];

/** @param {string} flag */
function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}

/** @param {string} html */
export function extractFontVars(html) {
  const htmlClass = html.match(/<html lang="en" class="([^"]*)"/)?.[1];
  if (!htmlClass) throw new Error("could not read the <html> class list");
  const vars = htmlClass
    .split(/\s+/)
    .filter((c) => c.endsWith("__variable"))
    .join(" ");
  if (!vars) throw new Error("no next/font variable classes on <html>");
  return vars;
}

/* The invite's names: its one `<h1>`, whole. It holds both of the asset's layouts and picks the
   single line by `(orientation: landscape)`, which a 1200x630 card always is. Fails LOUDLY: a
   silent fallback would ship a card with no names. */
/** @param {string} html */
export function extractNames(html) {
  const start = html.indexOf("<h1");
  const end = start === -1 ? -1 : html.indexOf("</h1>", start);
  if (start === -1 || end === -1)
    throw new Error("the invite's <h1> was not found");
  const h1 = html.slice(start, end + "</h1>".length);
  if (!h1.includes('href="#names-')) {
    throw new Error(
      "the <h1> carries no drawn names — the invite's markup changed",
    );
  }
  return h1;
}

/* The invite's own sprig divider, from its passage. Its spans hold no `<div>`, so the first
   `</div>` after it closes it. */
/** @param {string} html */
export function extractDivider(html) {
  const passage = html.indexOf("data-invite-passage");
  const at = passage === -1 ? -1 : html.indexOf("ornamental-divider", passage);
  const start = at === -1 ? -1 : html.lastIndexOf("<div", at);
  const end = start === -1 ? -1 : html.indexOf("</div>", start);
  if (start === -1 || end === -1 || start < passage) {
    throw new Error(
      "the invite's ornamental divider was not found in its passage",
    );
  }
  const divider = html.slice(start, end + "</div>".length);
  if (!divider.includes('href="#sprig-mark"')) {
    throw new Error("the divider carries no sprig — its markup changed");
  }
  return divider;
}

/* Every hidden symbol sheet the root layout mounts — the sprig and the names. A `<use>` resolves
   against its own document, so the card's document has to carry them. */
/** @param {string} html */
export function extractSymbols(html) {
  const blocks = [
    ...html.matchAll(
      /<svg aria-hidden="true" height="0"[^>]*><defs>[\s\S]*?<\/defs><\/svg>/g,
    ),
  ].map((m) => m[0]);
  const all = blocks.join("");
  for (const id of [
    "sprig-mark",
    "names-sebastian",
    "names-ampersand",
    "names-flemy",
  ]) {
    if (!all.includes(`id="${id}"`))
      throw new Error(`symbol #${id} not found on the page`);
  }
  return all;
}

/* Both events' dates, read off Event Info's sheets — the engagement's and the wedding's — and
   joined as one line: "4th & 9th January 2027". The month and year are said once, so the two must
   share them; if a date ever moves out of January 2027 the line cannot be written this way, and
   that is a loud failure rather than a wrong card. */
/** @param {string} html */
export function extractDates(html) {
  /** @param {string} id */
  const day = (id) => {
    const at = html.indexOf(`data-event="${id}"`);
    const p = at === -1 ? -1 : html.indexOf("type-date-primary", at);
    if (p === -1) throw new Error(`the ${id} sheet's date was not found`);
    const text = html
      .slice(p, html.indexOf("</p>", p))
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ");
    const m = text.match(
      /(\d{1,2})\s*(st|nd|rd|th)\s+(?:[A-Z][a-z]{2}\s*)?((?:January|February|March|April|May|June|July|August|September|October|November|December))\s+(\d{4})/,
    );
    if (!m)
      throw new Error(
        `could not read the ${id} date from "${text.slice(0, 80)}"`,
      );
    return { day: `${m[1]}${m[2]}`, month: m[3], year: m[4] };
  };
  const first = day("engagement");
  const second = day("wedding");
  if (first.month !== second.month || first.year !== second.year) {
    throw new Error(
      `the two dates do not share a month and year (${first.month} ${first.year} / ${second.month} ${second.year})`,
    );
  }
  return `${first.day} &amp; ${second.day} ${first.month} ${first.year}`;
}

/**
 * @param {{ fontVars: string, names: string, divider: string, symbols: string, dates: string, card: Card }} parts
 */
export function cardHtml({ fontVars, names, divider, symbols, dates, card }) {
  const flowers = PIECES.map(
    ({ piece, share, place }) =>
      `<img class="og-flower" alt="" src="botanical/${piece}-desktop.webp" style="${place(card)} width: ${(card.width * share * card.flowers).toFixed(2)}px;">`,
  ).join("\n    ");
  return `<!doctype html>
<html lang="en" class="${fontVars} h-full antialiased">
<head>
<meta charset="utf-8">
<title>OG card</title>
<link rel="stylesheet" href="app.css">
<style>
  html, body { margin: 0; padding: 0; overflow: hidden; background: none; }

  /* The roles read these custom properties, so overriding them sizes the card without touching a
     single .type-* rule. */
  .og-card {
    position: relative;
    width: ${card.width}px;
    height: ${card.height}px;
    box-sizing: border-box;
    display: grid;
    place-items: center;
    overflow: hidden;
    --text-display-name: ${card.names}px;
    --text-date-label: ${card.dates}px;
    --text-date-label--line-height: ${card.dates}px;
  }

  /* Each flower on its OWN element, blended as on the page; nothing above it takes a transform,
     opacity or filter, which would isolate the blend and paint its backing rectangle. */
  .og-flower { position: absolute; height: auto; mix-blend-mode: multiply; }

  .og-text { position: relative; display: flex; flex-direction: column; align-items: center; }
  .og-text h1 { margin: 0; padding: 0; }
  .og-text > :nth-child(2) { margin-top: ${card.gapDivider}px; }
  .og-dates { margin: ${card.gapDates}px 0 0; }
</style>
</head>
<body>
  <div class="og-card bg-surface-base">
    ${flowers}
    <div class="og-text">
      ${names}
      ${divider}
      <p class="og-dates type-date-label text-ink">${dates}</p>
    </div>
  </div>
  ${symbols}
</body>
</html>
`;
}

/** @param {string | URL} url */
async function get(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) }).catch(
    (error) => {
      throw new Error(`${error.message} for ${url}`);
    },
  );
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res;
}

/** @param {string} origin */
async function fetchAssets(origin) {
  const pageHtml = await (await get(`${origin}/`)).text();

  const sheetHrefs = [
    ...pageHtml.matchAll(/<link rel="stylesheet" href="([^"]+)"/g),
  ].map((m) => m[1]);
  if (sheetHrefs.length === 0)
    throw new Error("no stylesheets linked on the page");

  let css = "";
  for (const href of sheetHrefs) {
    css += `\n/* ${href} */\n${await (await get(new URL(href, origin))).text()}`;
  }
  if (!css.includes("@font-face")) {
    throw new Error(
      "no @font-face rules in the fetched CSS — fonts would not render",
    );
  }

  await rm(join(WORK, "fonts"), { recursive: true, force: true });
  await mkdir(join(WORK, "fonts"), { recursive: true });
  const mediaRefs = mediaFiles(css);
  for (const file of mediaRefs) {
    const buf = Buffer.from(
      await (await get(`${origin}/_next/static/media/${file}`)).arrayBuffer(),
    );
    await writeFile(join(WORK, "fonts", file), buf);
  }
  await writeFile(
    join(WORK, "app.css"),
    css.replace(/\.\.\/media\//g, "fonts/"),
  );

  await mkdir(join(WORK, "botanical"), { recursive: true });
  for (const { piece } of PIECES) {
    const file = `${piece}-desktop.webp`;
    await copyFile(
      join(ROOT, "public", "botanical", file),
      join(WORK, "botanical", file),
    );
  }

  return {
    fontVars: extractFontVars(pageHtml),
    names: extractNames(pageHtml),
    divider: extractDivider(pageHtml),
    symbols: extractSymbols(pageHtml),
    dates: extractDates(pageHtml),
    fonts: mediaRefs.size,
    sheets: sheetHrefs.length,
  };
}

/**
 * @param {string} htmlPath
 * @param {string} rawPath
 */
async function capture(htmlPath, rawPath) {
  const browser = await chromium.launch({ channel: "chromium" });
  try {
    /* Reduced motion: the site's own contract that every layer is complete on the first frame
       (DESIGN.md -> Motion -> "The opening sequence"), which is the state a still card wants. */
    const page = await browser.newPage({
      viewport: { width: CARD.width, height: CARD.height },
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
    });
    await page.goto(`file://${htmlPath}`, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready.then(() => true));
    /* `fonts.ready` resolves on a FAILED face too, so read each face's status, and confirm the dates'
       own face is loaded — the names are SVG and would pass every other check. */
    const fonts = await page.evaluate(() => {
      const dates = getComputedStyle(
        /** @type {Element} */ (document.querySelector(".og-dates")),
      );
      return {
        failed: [...document.fonts]
          .filter((f) => f.status === "error")
          .map((f) => f.family),
        dates: document.fonts.check(
          `${dates.fontWeight} ${dates.fontSize} ${dates.fontFamily}`,
        ),
      };
    });
    if (fonts.failed.length > 0)
      throw new Error(`fonts failed to load: ${fonts.failed.join(", ")}`);
    if (!fonts.dates)
      throw new Error(
        "the dates' face is not loaded — they would render in a fallback",
      );
    await page.waitForFunction(
      () =>
        [
          .../** @type {NodeListOf<HTMLImageElement>} */ (
            document.querySelectorAll(".og-flower")
          ),
        ].every((i) => i.complete && i.naturalWidth > 0),
      { timeout: 15000 },
    );

    /* Assert what the card must show rather than trusting the lift: the names drawn on ONE line and
       visible, the divider's sprig painted, every element settled and opaque. */
    const state = await page.evaluate(() => {
      const shown = [
        .../** @type {NodeListOf<SVGElement>} */ (
          document.querySelectorAll(".og-text h1 svg")
        ),
      ].filter((s) => getComputedStyle(s).display !== "none");
      const names = shown[0]?.getBoundingClientRect();
      const sprig = [
        ...document.querySelectorAll(".og-text use[href='#sprig-mark']"),
      ]
        .map((u) => u.closest("svg"))
        .find((s) => s && s.getBoundingClientRect().width > 0);
      return {
        layouts: shown.map((s) => s.dataset.namesLayout),
        namesBox: names ? [names.width, names.height] : null,
        sprig: Boolean(sprig),
        settled: [...document.querySelectorAll(".og-text *")].every((el) => {
          const cs = getComputedStyle(el);
          return cs.opacity === "1" && cs.animationName === "none";
        }),
        text: /** @type {Element} */ (document.querySelector(".og-text"))
          .getBoundingClientRect()
          .toJSON(),
      };
    });
    if (state.layouts.length !== 1 || state.layouts[0] !== "line") {
      throw new Error(
        `the names are not on one line (shown: ${state.layouts.join(", ") || "none"})`,
      );
    }
    if (!state.namesBox || state.namesBox[0] < 100)
      throw new Error("the names did not render");
    if (!state.sprig) throw new Error("the divider's sprig did not render");
    if (!state.settled) throw new Error("the card captured mid-entrance");
    if (
      state.text.left < 0 ||
      state.text.right > CARD.width ||
      state.text.top < 0 ||
      state.text.bottom > CARD.height
    ) {
      throw new Error("the type overflows the card");
    }

    await page.locator(".og-card").screenshot({ path: rawPath });
    return state;
  } finally {
    await browser.close();
  }
}

/* Quality is stepped down only until the budget is met. mozjpeg + 4:4:4: small saturated type on a
   light ground suffers visibly under the default 4:2:0 subsampling. */
/**
 * @param {string} rawPath
 * @param {string} outPath
 * @param {number} maxKb
 */
export async function compress(rawPath, outPath, maxKb) {
  const meta = await sharp(rawPath).metadata();
  if (meta.width !== CARD.width || meta.height !== CARD.height) {
    throw new Error(
      `raw shot is ${meta.width}x${meta.height}, expected ${CARD.width}x${CARD.height}`,
    );
  }
  /* Each trial is encoded in memory, so a run that cannot reach the budget leaves `outPath` as it
     was rather than holding the last over-budget trial. */
  for (const quality of QUALITY_STEPS) {
    const jpeg = await sharp(rawPath)
      .jpeg({ quality, mozjpeg: true, chromaSubsampling: "4:4:4" })
      .toBuffer();
    const kb = Math.round(jpeg.length / 1024);
    if (kb <= maxKb) {
      await writeFile(outPath, jpeg);
      return { quality, kb };
    }
  }
  throw new Error(`could not reach ${maxKb}KB`);
}

async function main() {
  const origin = argValue("--origin") ?? "http://localhost:3000";
  const out = resolve(ROOT, argValue("--out") ?? join(WORK, "og-card.jpg"));
  const card = { ...CARD };
  Object.assign(card, parseOverrides(process.argv));

  await mkdir(WORK, { recursive: true });
  const lifted = await fetchAssets(origin);
  const htmlPath = join(WORK, "card.html");
  await writeFile(htmlPath, cardHtml({ ...lifted, card }));

  const rawPath = join(WORK, "raw.png");
  const state = await capture(htmlPath, rawPath);
  await mkdir(dirname(out), { recursive: true });
  const { quality, kb } = await compress(rawPath, out, card.maxKb);

  console.log(
    `${out}  ${kb}KB at q${quality}  ${CARD.width}x${CARD.height}  ` +
      `(${lifted.sheets} stylesheets, ${lifted.fonts} fonts, names ${card.names}px ` +
      `→ ${/** @type {number[]} */ (state.namesBox).map((n) => n.toFixed(0)).join("x")}, dates ${card.dates}px, flowers ×${card.flowers}, ` +
      `"${lifted.dates.replace("&amp;", "&")}")`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    console.error(`build failed: ${err.message}`);
    process.exit(1);
  });
}
