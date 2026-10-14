/* Task 1 measurement: the card the thread's hand-drawn paths were authored against.
   Renders the real page (never /thread-lab, which has no cards) at each band's nominal
   viewport, and for every section reads:
     - the `.mounted-sheet-frame__box` element's rendered width and left offset (the card the
       thread must land on)
     - the outer `<section>`'s rendered height (cross-checked against thread-boxes.ts's
       `sectionBox`, which was measured the same way)
     - Flemy's and Sebastian's portrait centres as a fraction of the family section's card

   channel: "chromium" is required — the default reaches for headless_shell, which quantises
   glyph advances and renders text ~3% wider (lessons.md, 2026-09-21). */
import { chromium } from "playwright";

const BANDS = [
  { id: "tall", width: 393, height: 700 },
  { id: "upright", width: 820, height: 1180 },
  { id: "wide", width: 1536, height: 695 },
];

// Render order in app/page.tsx's <main>: invite has no id, the rest do.
const SECTION_IDS = [
  "invite",
  "event-info",
  "family",
  "celebrations",
  "wishes",
];

const browser = await chromium.launch({ channel: "chromium" });
const results = {};

for (const band of BANDS) {
  const page = await browser.newPage({
    viewport: { width: band.width, height: band.height },
    deviceScaleFactor: 1,
  });
  await page.goto("http://localhost:3000/", { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);

  const sectionCount = await page.locator("main > section").count();
  if (sectionCount !== SECTION_IDS.length) {
    throw new Error(
      `expected ${SECTION_IDS.length} sections, found ${sectionCount} at ${band.id}`,
    );
  }

  // Scroll every section into view first so lazy images resolve before any measurement.
  for (let i = 0; i < sectionCount; i += 1) {
    await page.locator("main > section").nth(i).scrollIntoViewIfNeeded();
  }
  await page.evaluate(async () => {
    const images = [...document.querySelectorAll("img")];
    const pending = images.filter(
      (img) => !(img.complete && img.naturalWidth > 0),
    );
    if (pending.length === 0) return;
    await Promise.race([
      Promise.all(
        pending.map(
          (img) =>
            new Promise((resolve) => {
              img.addEventListener("load", resolve, { once: true });
              img.addEventListener("error", resolve, { once: true });
            }),
        ),
      ),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
  });
  await page.waitForTimeout(200);

  const perSection = await page.evaluate((ids) => {
    const sections = [...document.querySelectorAll("main > section")];
    return sections.map((section, index) => {
      const id = ids[index];
      // Confirm the DOM's own id (where present) agrees with the assumed render order.
      const domId = section.id || null;
      const card = section.querySelector(".mounted-sheet-frame__box");
      const sectionRect = section.getBoundingClientRect();
      const cardRect = card ? card.getBoundingClientRect() : null;
      return {
        id,
        domId,
        sectionHeight: Math.round(sectionRect.height),
        cardWidth: cardRect ? Math.round(cardRect.width) : null,
        cardLeft: cardRect ? Math.round(cardRect.left) : null,
      };
    });
  }, SECTION_IDS);

  // Verify assumed order against the DOM's own ids (invite and celebrations carry none).
  for (const row of perSection) {
    if (row.domId !== null && row.domId !== row.id) {
      throw new Error(
        `render-order assumption broken: expected "${row.id}", DOM id is "${row.domId}"`,
      );
    }
  }

  const familyIndex = SECTION_IDS.indexOf("family");
  const portraits = await page.evaluate((familyIndex) => {
    const familySection =
      document.querySelectorAll("main > section")[familyIndex];
    const card = familySection.querySelector(".mounted-sheet-frame__box");
    const cardRect = card.getBoundingClientRect();
    const fraction = (rect) => ({
      x: (rect.left + rect.width / 2 - cardRect.left) / cardRect.width,
      y: (rect.top + rect.height / 2 - cardRect.top) / cardRect.height,
    });
    const flemy = familySection.querySelector('img[src*="flemy-roy"]');
    const sebastian = familySection.querySelector('img[src*="sebastian"]');
    return {
      flemy: flemy ? fraction(flemy.getBoundingClientRect()) : null,
      sebastian: sebastian ? fraction(sebastian.getBoundingClientRect()) : null,
    };
  }, familyIndex);

  results[band.id] = { sections: perSection, portraits };
  await page.close();
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
