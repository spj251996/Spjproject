import { chromium } from "playwright";

/* Where the sprig's bottom actually sits below the row's top, now that baseline alignment moves
   the span down. The spine must start a gap below THAT, not below an assumed 16px node at the row
   top — which is why it currently overlaps the mark. */
const b = await chromium.launch({ channel: "chromium" });
console.log(
  "\nband      heading-md  heading-lg  span top  sprig bottom  needed margin-top  as em of heading-md",
);
for (const [w, h, band] of [
  [820, 1180, "tablet "],
  [1536, 695, "laptop "],
  [1920, 1080, "desktop"],
]) {
  const p = await b.newPage({
    viewport: { width: w, height: h },
    reducedMotion: "reduce",
  });
  await p.goto("http://localhost:3000/preview", { waitUntil: "load" });
  await p.waitForSelector("aside[aria-label='Preview options']");
  await p.waitForFunction(
    () => {
      const r = [...document.querySelectorAll("input[name='pv-ritual-align']")];
      if (r.length < 4) return false;
      for (const el of r) el.checked = false;
      r[3].click();
      return (
        document.documentElement.getAttribute("data-pv-ritual-align") === "rail"
      );
    },
    null,
    { timeout: 8000, polling: 150 },
  );
  await p.waitForTimeout(350);
  const r = await p.evaluate(() => {
    const out = [];
    for (const li of document.querySelectorAll("#celebrations ol > li")) {
      const lb = li.getBoundingClientRect();
      const span = li
        .querySelector(":scope > div > div > span")
        .getBoundingClientRect();
      const sprig = li
        .querySelector(":scope > div > div > span svg")
        .getBoundingClientRect();
      out.push({
        spanTop: span.top - lb.top,
        sprigBottom: sprig.bottom - lb.top,
      });
    }
    const cs = getComputedStyle(document.documentElement);
    return {
      rows: out,
      md: Number.parseFloat(cs.getPropertyValue("--text-heading-md")),
      lg: Number.parseFloat(cs.getPropertyValue("--text-heading-lg")),
      gap: Number.parseFloat(cs.getPropertyValue("--spacing-space-3xs")),
    };
  });
  const sb = r.rows.map((x) => x.sprigBottom);
  const worst = Math.max(...sb);
  const need = worst + r.gap;
  console.log(
    `${band}  ${String(r.md).padStart(10)}  ${String(r.lg).padStart(10)}  ${r.rows[0].spanTop.toFixed(1).padStart(8)}  ${worst.toFixed(1).padStart(12)}  ${need.toFixed(1).padStart(17)}  ${(need / r.md).toFixed(3).padStart(19)}`,
  );
  await p.close();
}
await b.close();
