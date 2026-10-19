/* Re-measures each section's own rect height at the three band nominals, on `/thread`, the route
   the thread's constants describe.

   `getBoundingClientRect().height`, never `scrollHeight`: the rect is what the committed constants
   came from.

   The URL carries `.html` deliberately: a plain static server serves literal paths, and under
   `output: "export"` the static route emits `out/thread.html`, with the sibling directory holding only
   RSC payload `.txt` files. */
import { chromium } from "playwright";

const PORT = process.argv[2] ?? "4931";
const URL = `http://localhost:${PORT}/thread.html`;
const BANDS = [
  { id: "tall", width: 393, height: 700 },
  { id: "upright", width: 820, height: 1180 },
  { id: "wide", width: 1536, height: 695 },
];
const IDS = ["invite", "event-info", "family", "celebrations", "wishes"];

const browser = await chromium.launch({ channel: "chromium" });
/** @type {Record<string, Record<string, number>>} */
const out = {};
for (const band of BANDS) {
  const page = await browser.newPage({
    viewport: { width: band.width, height: band.height },
  });
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  /* Scroll the whole page first: `next/image` lazy-loads, so a below-the-fold portrait has no src
     until it comes into view — and it is never `complete`, never fires `load`, and never fires
     `error`, so an unbounded wait on it hangs forever. Scroll to arm them, then bound the wait
     anyway. */
  await page.evaluate(async () => {
    const step = window.innerHeight;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
    await document.fonts.ready;
    const settled = [...document.images].map((img) =>
      img.complete
        ? Promise.resolve()
        : Promise.race([
            new Promise((r) => {
              img.addEventListener("load", r, { once: true });
              img.addEventListener("error", r, { once: true });
            }),
            new Promise((r) => setTimeout(r, 4000)),
          ]),
    );
    await Promise.all(settled);
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    );
    await new Promise((r) => setTimeout(r, 250));
  });
  out[band.id] = await page.evaluate(
    (ids) =>
      Object.fromEntries(
        ids.map((id) => [
          id,
          Math.round(
            document.getElementById(id)?.getBoundingClientRect().height ?? -1,
          ),
        ]),
      ),
    IDS,
  );
  await page.close();
}
await browser.close();
console.log(JSON.stringify(out, null, 2));
