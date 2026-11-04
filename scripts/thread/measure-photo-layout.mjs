#!/usr/bin/env node
/* Measures the page the redraw was drawn on — every ritual's photo strip showing — for
 * `adapt-photo-states.mjs`: each ritual's block, its description's last line, the bottom of its
 * strip, every line box of type, the sections and each portrait's centre, all in `<main>`'s
 * coordinates; then removes one
 * strip and measures again, which gives the height a strip adds.
 *
 * usage: node scripts/thread/measure-photo-layout.mjs <url of a build with stand-in photos>
 * Writes `assets/thread/<band>/photo-layout.json` for each band. The page must carry a photo strip
 * on every ritual, as the sheets did.
 */

import { writeFileSync } from "node:fs";
import { chromium } from "playwright";

const BANDS = {
  tall: { width: 393, height: 700 },
  upright: { width: 820, height: 1180 },
  wide: { width: 1536, height: 695 },
};
/* A ritual's photo strip: the block under its description in the ritual's row. */
const STRIP = "[data-thread-row] div.mt-space-sm.w-full.text-end";

const url = process.argv[2];
if (!url) {
  console.error("usage: node scripts/thread/measure-photo-layout.mjs <url>");
  process.exit(1);
}

const browser = await chromium.launch({ channel: "chromium" });
try {
  for (const [band, viewport] of Object.entries(BANDS)) {
    const page = await browser.newPage({
      viewport,
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
    });
    await page.goto(url, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready.then(() => true));
    const sections = page.locator("main > section");
    for (let i = 0; i < (await sections.count()); i += 1)
      await sections.nth(i).scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    const layout = await page.evaluate((strip) => {
      const main = /** @type {HTMLElement} */ (document.querySelector("main"));
      const origin = main.getBoundingClientRect().top + window.scrollY;
      const box = (/** @type {DOMRect} */ r) => ({
        left: r.left + window.scrollX,
        right: r.right + window.scrollX,
        top: r.top + window.scrollY - origin,
        bottom: r.bottom + window.scrollY - origin,
      });
      /** @type {{ left: number, right: number, top: number, bottom: number, text: string }[]} */
      const glyphs = [];
      const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = (node.nodeValue ?? "").trim();
        const parent = node.parentElement;
        if (!text || !parent || parent.closest("[aria-hidden='true']"))
          continue;
        const style = getComputedStyle(parent);
        if (style.visibility === "hidden" || style.display === "none") continue;
        const own = parent.getBoundingClientRect();
        if (own.width <= 1 && own.height <= 1) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const r of range.getClientRects())
          if (r.width >= 0.5 && r.height >= 0.5)
            glyphs.push({ ...box(r), text: text.slice(0, 40) });
      }
      const rows = [...document.querySelectorAll("[data-thread-row]")].map(
        (li) => {
          const lines = li.querySelectorAll("p");
          const own = box(li.getBoundingClientRect());
          const text = glyphs.filter(
            (g) => g.top >= own.top - 1 && g.bottom <= own.bottom + 1,
          );
          const stripBox = li.querySelector(
            ":scope div.mt-space-sm.w-full.text-end",
          );
          return {
            top: own.top,
            descBottom: box(lines[lines.length - 1].getBoundingClientRect())
              .bottom,
            stripBottom: stripBox
              ? box(stripBox.getBoundingClientRect()).bottom
              : null,
            textLeft: Math.min(...text.map((g) => g.left)),
            textRight: Math.max(...text.map((g) => g.right)),
          };
        },
      );
      const sectionBoxes = [...document.querySelectorAll("main > section")].map(
        (s) => ({
          id: s.id,
          top: box(s.getBoundingClientRect()).top,
          bottom: box(s.getBoundingClientRect()).bottom,
        }),
      );
      const celebrations = /** @type {HTMLElement} */ (
        document.getElementById("celebrations")
      );
      const before = celebrations.getBoundingClientRect().height;
      const strips = document.querySelectorAll(strip);
      strips[strips.length - 1].remove();
      const strip_ = before - celebrations.getBoundingClientRect().height;
      const portraits = [
        ...main.querySelectorAll("[data-relationship] img"),
      ].map((img) => {
        const r = box(img.getBoundingClientRect());
        return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 };
      });
      return {
        width: document.documentElement.clientWidth,
        portraits,
        strip: Math.round(strip_ * 64) / 64,
        strips: strips.length,
        sections: sectionBoxes,
        rows,
        glyphs,
      };
    }, STRIP);
    if (
      layout.strips !== layout.rows.length ||
      layout.rows.some((r) => r.stripBottom === null)
    )
      throw new Error(
        `${band}: ${layout.strips} strips for ${layout.rows.length} rituals — measure a page with a strip on every ritual`,
      );
    const { strips, ...record } = layout;
    writeFileSync(
      `assets/thread/${band}/photo-layout.json`,
      `${JSON.stringify(record, null, 2)}\n`,
    );
    console.log(
      `${band}: strip ${record.strip}px, ${record.rows.length} rituals, ${record.glyphs.length} line boxes`,
    );
    await page.close();
  }
} finally {
  await browser.close();
}
