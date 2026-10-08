/* Builds public/og-card.jpg's source — the 1200x630 link-preview card — from the running dev
 * server. Nothing under app/ is touched.
 *
 * The card is the invite's own stock, content and rhythm, with the couple illustration from the
 * closing section beside them. DESIGN.md -> Domain Components -> Link Preview Card is the contract.
 *
 * METHOD:
 *   1. Fetch the page. Lift the next/font variable classes, the invite's rendered header run and
 *      the sprig <symbol>. Strings are LIFTED, never re-derived — re-implementing formatEventDate
 *      would be a second implementation free to drift from the one the site ships.
 *   2. Fetch every linked stylesheet and every font file it references into tmp/og-card/, so the
 *      card is one origin and the @font-face requests are not cross-origin.
 *   3. Copy public/couple/* in beside the html. The src is RELATIVE: the page is opened over
 *      file://, where an absolute /couple/... would resolve to the filesystem root and the drawing
 *      would silently render as a broken image in an otherwise correct card.
 *   4. Write tmp/og-card/card.html, screenshot the .og-card element, step JPEG quality down to the
 *      size budget.
 *
 * ENGINE PIN (mandatory): chromium.launch({ channel: "chromium" }). The default launch reaches for
 * Chromium's old headless_shell, which applies full FreeType hinting and quantises glyph advances
 * to integers — text renders about 3% wider and every measured value is wrong.
 *
 * NO CSS MODULE: the card owns its two-column grid. Borrowing Wishes' hashed .stack broke silently
 * whenever that module's hash or its (width >= 64rem) and (orientation: landscape) query moved, and
 * it dragged a responsive composition into a box that is fixed at 1200x630 forever. The type roles
 * are global classes, so they still come from the real compiled CSS.
 *
 * OUTPUT is tmp/ by default, deliberately: a generated file is written to tmp/, diffed, then copied
 * in. Pass --out to place it.
 *
 * USAGE:
 *   node scripts/build-og-card.mjs                        # -> tmp/og-card/og-card.jpg
 *   node scripts/build-og-card.mjs --out assets/og/og-card.jpg
 *   node scripts/build-og-card.mjs --names 120 --sprig 44 --padding 80 --saturate 1.2
 */

import {
  copyFile,
  mkdir,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WORK = join(ROOT, "tmp", "og-card");

/* Every value the card changes from the live section, in one place, so the render can be checked
   against the intent rather than against scattered literals. */
export const CARD = Object.freeze({
  width: 1200,
  height: 630,
  /* The ONLY band. A ground + mount + padding arrangement was built, rendered and rejected by the
     owner as cramped; the content box was arithmetically the same, so the cost was purely visual.
     This padding is also the bleed margin: everything under 96px per side is paper, not content. */
  padding: 96,
  textColumnFr: 58,
  /* Small type is raised far above the page's, but no further than it must be: the eyebrow renders
     6.0px in a 340px chat bubble at 21, and the step below (19) renders 5.4px and reads as a gold
     smudge. Judged on a downscaled strip, not at full size. */
  type: Object.freeze({
    eyebrow: 21,
    eyebrowLine: 29,
    /* The card's OWN line box, not the page's ratio. Measured: at 110px the names draw 111px of ink
       inside a 173px line box — 1.56x their own drawing. The page's ratio exists so a script clears
       its neighbours in a flowing column; here they are known. The ratio below is 1.164.

       The names are the ONE role that did not come down when the rest did — the owner's words were
       "reduce size all text except couples names". */
    names: 116,
    namesLine: 135,
    date: 32,
    dateLine: 40,
    caption: 21,
    captionLine: 29,
  }),
  /* The gaps come down with the type: dropping sizes alone leaves the block scattered rather than
     smaller. */
  gapNames: 28,
  gapDate: 22,
  gapPlace: 4,
  /* Rendered HEIGHT, not a diagonal span: the mark's 16px floor is stated on its rendered height,
     and its viewBox is not square. Width follows the viewBox ratio. */
  sprigHeight: 40,
  sprigSpaceAbove: 28,
  maxKb: 400,
});

const SPRIG_VIEWBOX_RATIO = 174.6 / 169.8;
const QUALITY_STEPS = [95, 92, 90, 88, 85, 82, 80, 76, 72];

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}

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

/* Anchored on the eyebrow's exact text and on `data-invite-place`, a data attribute the section
   already carries — not on Tailwind class soup, which is what went stale last time. The five rows
   are contiguous in the DOM, so one slice takes all of them and the card never re-assembles them.

   CONTIGUITY IS THE WHOLE CONTRACT, and it is silent when broken: anything added to the invite's
   header OUTSIDE this run is simply missing from the card, and no check here would see it. The
   invitation's own line was added inside it in Phase 7; `app/invite-line.test.ts` is what asserts the
   source order that keeps it there.

   It must fail LOUDLY: a silent fallback would ship a card missing a line. */
export function extractInvite(html) {
  const start = html.indexOf(
    '<p class="type-eyebrow">We are getting married</p>',
  );
  const placeAt = html.indexOf('data-invite-place="true"');
  const end = placeAt === -1 ? -1 : html.indexOf("</p>", placeAt);
  if (start === -1 || placeAt === -1 || end === -1 || placeAt < start) {
    throw new Error(
      `invite markup incomplete (eyebrow:${start !== -1} place:${placeAt !== -1}) — the section's markup changed`,
    );
  }
  return html.slice(start, end + "</p>".length);
}

/* The mark renders through <use href="#sprig-mark">, which resolves against the document — so the
   symbol has to travel with the card. */
export function extractSprigSymbol(html) {
  const at = html.indexOf('<defs><symbol id="sprig-mark"');
  const close = at === -1 ? -1 : html.indexOf("</defs>", at);
  if (at === -1 || close === -1) {
    throw new Error("sprig symbol not found on the page");
  }
  const defs = html.slice(at, close + "</defs>".length);
  return `<svg aria-hidden="true" height="0" role="presentation" width="0" style="position:absolute">${defs}</svg>`;
}

export function cardHtml({ fontVars, invite, sprigSymbol, card }) {
  const sprigWidth = (card.sprigHeight * SPRIG_VIEWBOX_RATIO).toFixed(4);
  return `<!doctype html>
<html lang="en" class="${fontVars} h-full antialiased">
<head>
<meta charset="utf-8">
<title>OG card</title>
<link rel="stylesheet" href="app.css">
<style>
  html, body { margin: 0; padding: 0; overflow: hidden; background: none; }

  /* The type roles read these custom properties, so overriding them scales the card without
     touching a single .type-* rule. Equal specificity to :root, later in source order, so these
     win over the scale's own definitions. */
  .og-card {
    width: ${card.width}px;
    height: ${card.height}px;
    box-sizing: border-box;
    padding: ${card.padding}px;
    display: grid;
    grid-template-columns: ${card.textColumnFr}fr ${100 - card.textColumnFr}fr;
    align-items: center;

    --text-eyebrow: ${card.type.eyebrow}px;
    --text-eyebrow--line-height: ${card.type.eyebrowLine}px;
    --text-display-name: ${card.type.names}px;
    --text-display-name--line-height: ${card.type.namesLine}px;
    --text-date-primary: ${card.type.date}px;
    --text-date-primary--line-height: ${card.type.dateLine}px;
    --text-caption: ${card.type.caption}px;
    --text-caption--line-height: ${card.type.captionLine}px;
  }

  .og-text { display: flex; flex-direction: column; align-items: center; }

  /* The gaps come down with the type. The lifted markup carries the page's own utility classes, so
     these override them by specificity rather than by editing what was lifted. */
  .og-text .type-display-name { margin-top: ${card.gapNames}px; }
  .og-text .type-date-primary { margin-top: ${card.gapDate}px; }
  .og-text [data-invite-place] { margin-top: ${card.gapPlace}px; }

  /* Bottom-flush on the content box, as in Wishes: the drawing's own lower edge is already cropped,
     so it is drawn to sit on a base rather than float. It is also the TALLEST element on the card,
     so the figure column, not the type, is the lever if it reads crowded. */
  .og-figure { width: 100%; height: auto; align-self: end; }

  /* display:block on the SVG ITSELF, not just its wrapper: inline, it sits on a line box and
     renders ~8px taller than asked — 55.8px for height="48". The shipped ornamental-divider markup
     carries a block-display utility on its wrapper spans for the same reason. */
  .og-sprig { margin-top: ${card.sprigSpaceAbove}px; display: block; }
  .og-sprig svg { display: block; }
${card.figureFilter ? `  .og-figure { filter: ${card.figureFilter}; }\n` : ""}</style>
</head>
<body>
  <div class="og-card bg-surface-elevated">
    <div class="og-text">
      ${invite}
      <span class="og-sprig text-accent-gold"><svg aria-hidden="true" fill="currentColor" role="presentation" viewBox="0 0 174.6 169.8" width="${sprigWidth}" height="${card.sprigHeight}"><use href="#sprig-mark"></use></svg></span>
    </div>
    <img class="og-figure" alt="" src="couple/couple-2x.webp">
  </div>
  ${sprigSymbol}
</body>
</html>
`;
}

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res;
}

async function fetchAssets(origin) {
  const pageHtml = await (await get(`${origin}/`)).text();

  const sheetHrefs = [
    ...pageHtml.matchAll(/<link rel="stylesheet" href="([^"]+)"/g),
  ].map((m) => m[1]);
  if (sheetHrefs.length === 0) {
    throw new Error("no stylesheets linked on the page");
  }

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
  const mediaRefs = new Set(
    [...css.matchAll(/url\(["']?\.\.\/media\/([^"')]+)["']?\)/g)].map(
      (m) => m[1],
    ),
  );
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

  /* The drawing is loaded relative to card.html, so it sits beside it — see the file:// note in the
     header. */
  await mkdir(join(WORK, "couple"), { recursive: true });
  const coupleDir = join(ROOT, "public", "couple");
  for (const file of await readdir(coupleDir)) {
    await copyFile(join(coupleDir, file), join(WORK, "couple", file));
  }

  return {
    fontVars: extractFontVars(pageHtml),
    invite: extractInvite(pageHtml),
    sprigSymbol: extractSprigSymbol(pageHtml),
    fonts: mediaRefs.size,
    sheets: sheetHrefs.length,
  };
}

async function capture(htmlPath, rawPath) {
  const browser = await chromium.launch({ channel: "chromium" });
  try {
    /* The card is a single still frame, so nothing on it may be caught mid-animation. The page's
       entrance reaches the card through the same compiled stylesheet the card fetches, and the
       opening sequence adds a "type" layer that fades from opacity 0 — an opacity-0 capture would
       be INVISIBLE to every other check here, because the overflow assertion measures boxes and
       opacity does not move a box.

       Reduced motion rather than an `animation: none` sledgehammer, because it is the site's OWN
       contract: DESIGN.md -> Motion -> "The opening sequence" states that reduced motion collapses
       the sequence so every layer is present and complete on the first frame. That is exactly the
       state a still card wants. */
    const page = await browser.newPage({
      viewport: { width: CARD.width, height: CARD.height },
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
    });
    await page.goto(`file://${htmlPath}`, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready.then(() => true));
    /* The drawing is an <img>, so wait for the decode rather than a timeout — a shot that races the
       load captures an empty column and looks like a layout bug. */
    await page.waitForFunction(
      () => {
        const img = document.querySelector(".og-figure");
        return img?.complete && img.naturalWidth > 0;
      },
      { timeout: 15000 },
    );

    /* Trusting reduced motion is not enough: a previous round on this branch shipped a
       reduced-motion rule that LOST ON SPECIFICITY and removed nothing, and only a render caught
       it. Assert the settled state rather than assuming the media query won. */
    const settled = await page.evaluate(() =>
      [...document.querySelectorAll(".og-text *")].every((el) => {
        const cs = getComputedStyle(el);
        return cs.opacity === "1" && cs.animationName === "none";
      }),
    );
    if (!settled) {
      throw new Error(
        "the card captured mid-entrance: an element under .og-text is not opaque and settled",
      );
    }

    /* Content overflowing the card is invisible in the screenshot: nothing clips, so the overflow
       paints over the padding and reads as a tighter design. Measured before the shot, it is a hard
       failure. */
    const fit = await page.evaluate(() => {
      const card = document.querySelector(".og-card");
      const cs = getComputedStyle(card);
      return {
        inner:
          card.clientHeight -
          parseFloat(cs.paddingTop) -
          parseFloat(cs.paddingBottom),
        text: document.querySelector(".og-text").scrollHeight,
        figure: document.querySelector(".og-figure").getBoundingClientRect()
          .height,
      };
    });
    if (fit.text > fit.inner || fit.figure > fit.inner) {
      throw new Error(
        `content overflows the card: text ${fit.text.toFixed(1)}px, ` +
          `figure ${fit.figure.toFixed(1)}px, available ${fit.inner}px`,
      );
    }

    await page.locator(".og-card").screenshot({ path: rawPath });
    return fit;
  } finally {
    await browser.close();
  }
}

/* Quality is stepped down only until the budget is met, so a card that fits at 92 is never encoded
   at 80. mozjpeg + 4:4:4: the gold eyebrow is small saturated text on a light ground, and the
   default 4:2:0 subsampling is visibly destructive on exactly that. */
async function compress(rawPath, outPath, maxKb) {
  const meta = await sharp(rawPath).metadata();
  if (meta.width !== CARD.width || meta.height !== CARD.height) {
    throw new Error(
      `raw shot is ${meta.width}x${meta.height}, expected ${CARD.width}x${CARD.height}`,
    );
  }
  for (const quality of QUALITY_STEPS) {
    await sharp(rawPath)
      .jpeg({ quality, mozjpeg: true, chromaSubsampling: "4:4:4" })
      .toFile(outPath);
    const kb = Math.round((await stat(outPath)).size / 1024);
    if (kb <= maxKb) return { quality, kb };
  }
  throw new Error(`could not reach ${maxKb}KB`);
}

async function main() {
  const origin = argValue("--origin") ?? "http://localhost:3000";
  const out = resolve(ROOT, argValue("--out") ?? join(WORK, "og-card.jpg"));

  const card = {
    ...CARD,
    type: { ...CARD.type },
    figureFilter: argValue("--saturate")
      ? `saturate(${argValue("--saturate")})`
      : null,
  };
  if (argValue("--names")) {
    card.type.names = Number(argValue("--names"));
    /* The card's own ratio (see CARD.type.names), so a tuned size keeps the tightened line box
       rather than inheriting the default's absolute one. 116 x 1.164 = 135, CARD's own pair. */
    card.type.namesLine = Math.round(card.type.names * 1.164);
  }
  if (argValue("--sprig")) card.sprigHeight = Number(argValue("--sprig"));
  if (argValue("--padding")) card.padding = Number(argValue("--padding"));

  await mkdir(WORK, { recursive: true });
  const lifted = await fetchAssets(origin);

  const htmlPath = join(WORK, "card.html");
  await writeFile(
    htmlPath,
    cardHtml({
      fontVars: lifted.fontVars,
      invite: lifted.invite,
      sprigSymbol: lifted.sprigSymbol,
      card,
    }),
  );

  const rawPath = join(WORK, "raw.png");
  const fit = await capture(htmlPath, rawPath);
  await mkdir(dirname(out), { recursive: true });
  const { quality, kb } = await compress(rawPath, out, card.maxKb);

  console.log(
    `${out}  ${kb}KB at q${quality}  ${CARD.width}x${CARD.height}  ` +
      `(${lifted.sheets} stylesheets, ${lifted.fonts} fonts, padding ${card.padding}px, ` +
      `names ${card.type.names}px, sprig ${card.sprigHeight}px, ` +
      `stack ${fit.text} / figure ${fit.figure.toFixed(1)} of ${fit.inner})`,
  );
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(`build failed: ${err.message}`);
    process.exit(1);
  });
}
