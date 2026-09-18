#!/usr/bin/env node
/* Measures how a section's content stack fits its card, for the `mounted-sheet` frame in
   `components/layout/mounted-sheet-frame.ts`. Drives the `playwright-cli` devDependency, as
   `scripts/verify-section.mjs` does, never `playwright-core` directly.

   Method: for each width tier the window is set in both orientations, so content that differs by
   orientation is measured as it renders. Web fonts are confirmed loaded, every stack the selector
   matches is cloned into its own detached flex-column host, and each host's width is swept from 120
   to 1300px; the height at a width is the tallest stack's. Height is a step function of width, so
   every width where it changes is a regime boundary, bisected to 1/1024px. The sweep runs inside the
   page in one `page.evaluate` call per tier and orientation, with no per-pixel round trip.

   Usage:
     node scripts/measure-section-fit.mjs --route=/ --selector="div:has(> h1.type-display-name)" \
       --section=invite --out=app/invite-fit.ts

   `--out` sits beside `app/page.tsx`, which supplies the section's fit, e.g. `app/invite-fit.ts`
   for the invite.

   Writes a `MeasuredFit` (mounted-sheet-frame.ts) as a typed TS module, with a portrait and a
   landscape set of regimes under each width tier. The frame's own `assertValidFit` — ascending
   regime widths, non-rising heights, both orientations present — validates the file at the point
   of use; this script performs the same check before writing, so a malformed sweep is caught here
   rather than at render time. */

import { spawn, spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const ORIGIN = "http://localhost:3000";
const SESSION = "measure-fit";
const CLI_TIMEOUT_MS = 120_000;

const MIN_WIDTH = 120;
const MAX_WIDTH = 1300;

/* One width safely inside each width tier, away from the 768/1024/1600 breakpoints. Each is swept at
   both orientations' heights below — irrelevant to the clone, which is measured off-screen in a
   detached host, but the window itself must actually be portrait or landscape for the section's
   own on-screen layout (and so `document.fonts.ready`, loaded before the clone is taken) to
   resolve as a guest would see it. */
const TIERS = [
  { key: "mobile", width: 400 },
  { key: "tablet", width: 900 },
  { key: "desktop", width: 1280 },
  { key: "wide", width: 1700 },
];

/* Heights that set the orientation without pretending to be a real device; the sweep only needs
   the section's type resolved at that tier and orientation. */
const ORIENTATIONS = [
  { key: "portrait", heightFor: (width) => Math.round(width * 1.5) },
  { key: "landscape", heightFor: (width) => Math.round(width * 0.6) },
];

function parseArgs(argv) {
  const flags = {};
  for (const arg of argv) {
    const match = arg.match(/^--([a-z]+)=(.*)$/s);
    if (match) {
      flags[match[1]] = match[2];
      continue;
    }
    if (arg === "--falsify") {
      flags.falsify = "true";
    }
  }
  return flags;
}

const args = parseArgs(process.argv.slice(2));
const route = args.route ?? "/";
const selector = args.selector;
const section = args.section;
const outPath = args.out;
const falsify = args.falsify === "true";
const exportName =
  args.var ??
  `${section ? section.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) : "section"}Fit`;

if (!selector || !section || !outPath) {
  console.error(
    "usage: node scripts/measure-section-fit.mjs --route=/ --selector=<css> --section=<name> --out=<path.ts> [--var=<exportName>] [--falsify]",
  );
  process.exit(2);
}

function safeKill(pid, label) {
  try {
    process.kill(-pid);
  } catch (error) {
    if (error.code !== "ESRCH") {
      console.error(`cleanup: ${label} kill failed — ${error.message}`);
    }
  }
}

function cli(...cliArgs) {
  const result = spawnSync(
    "npx",
    ["playwright-cli", `-s=${SESSION}`, ...cliArgs],
    { encoding: "utf8", timeout: CLI_TIMEOUT_MS },
  );
  if (result.status !== 0) {
    throw new Error(
      `playwright-cli ${cliArgs[0]} failed:\n${result.error?.message ?? (result.stderr || result.stdout)}`,
    );
  }
  return result.stdout.trim();
}

async function isUp() {
  try {
    const response = await fetch(ORIGIN, { signal: AbortSignal.timeout(1000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function ensureDevServer() {
  if (await isUp()) {
    return null;
  }
  const child = spawn("npm", ["run", "dev"], {
    stdio: "ignore",
    detached: true,
  });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (await isUp()) {
      return child;
    }
  }
  safeKill(child.pid, "startup dev server");
  throw new Error("dev server did not answer within 60s");
}

/* Built as a plain JS string, not through page.evaluate's argument-passing, so the selector and
   the falsify flag are interpolated as JS literals directly into the evaluated source. Runs the
   entire sweep — clone, resize the host, bisect every boundary — inside the page in one call, so
   the round trip to the CLI happens once per tier rather than once per width. */
function sweepScript(cssSelector, mutateContent) {
  const selectorLiteral = JSON.stringify(cssSelector);
  const mutate = mutateContent
    ? `const heading = document.querySelector("h1.type-display-name"); if (heading) heading.textContent += " — a much longer rendering of the couple names, added only to falsify the measuring script";`
    : "";
  return `async () => await page.evaluate(async () => {
  const SELECTOR = ${selectorLiteral};
  await document.fonts.ready;
  ${mutate}
  const sources = [...document.querySelectorAll(SELECTOR)];
  if (sources.length === 0) {
    return { error: "selector not found: " + SELECTOR };
  }

  /* Each stack gets its own host and the sweep reads the tallest. A maximum of non-rising step
     functions is itself non-rising, so validation still holds. */
  const measured = sources.map((source) => {
    const host = document.createElement("div");
    host.style.cssText =
      "position:fixed;top:-100000px;left:-100000px;visibility:hidden;display:flex;flex-direction:column;pointer-events:none;";
    const clone = source.cloneNode(true);
    clone.style.width = "100%";
    clone.style.maxWidth = "none";
    host.appendChild(clone);
    document.body.appendChild(host);
    return { host, clone };
  });

  function heightAt(width) {
    let tallest = 0;
    for (const { host, clone } of measured) {
      host.style.width = width + "px";
      tallest = Math.max(tallest, clone.getBoundingClientRect().height);
    }
    return tallest;
  }

  const MIN_WIDTH = ${MIN_WIDTH};
  const MAX_WIDTH = ${MAX_WIDTH};
  const STEP_EPSILON = 0.05;

  const heights = [];
  for (let w = MIN_WIDTH; w <= MAX_WIDTH; w += 1) {
    heights.push(heightAt(w));
  }

  const regimes = [{ minContentWidth: MIN_WIDTH, contentHeight: heights[0] }];
  for (let i = 1; i < heights.length; i += 1) {
    if (Math.abs(heights[i] - heights[i - 1]) > STEP_EPSILON) {
      let lo = MIN_WIDTH + i - 1;
      let hi = MIN_WIDTH + i;
      const loHeight = heights[i - 1];
      while (hi - lo > 1 / 1024) {
        const mid = (lo + hi) / 2;
        const h = heightAt(mid);
        if (Math.abs(h - loHeight) <= STEP_EPSILON) {
          lo = mid;
        } else {
          hi = mid;
        }
      }
      const boundary = Math.round(hi * 1024) / 1024;
      regimes.push({ minContentWidth: boundary, contentHeight: heightAt(hi) });
    }
  }

  for (const { host } of measured) {
    document.body.removeChild(host);
  }
  return { regimes };
})`;
}

function round6(value) {
  return Math.round(value * 1e6) / 1e6;
}

/* The same shape mounted-sheet-frame.ts's assertValidFit checks at the point of use: ascending
   widths, and a height that never rises as width grows. Checked here too so a malformed sweep is
   caught at generation time, not at first render. */
function validateRegimes(tier, regimes) {
  if (regimes.length === 0) {
    throw new Error(`measure-section-fit: no regimes measured for ${tier}`);
  }
  for (let i = 1; i < regimes.length; i += 1) {
    if (!(regimes[i].minContentWidth > regimes[i - 1].minContentWidth)) {
      throw new Error(
        `measure-section-fit: ${tier} regime ${i} does not start wider than regime ${i - 1}`,
      );
    }
    if (regimes[i].contentHeight > regimes[i - 1].contentHeight) {
      throw new Error(
        `measure-section-fit: ${tier} regime ${i} stands taller than regime ${i - 1} at a wider width`,
      );
    }
  }
}

async function measureTierOrientation(tier, orientation, mutateContent) {
  const label = `${tier.key} ${orientation.key}`;
  cli("resize", String(tier.width), String(orientation.heightFor(tier.width)));
  cli("reload");
  const raw = cli("run-code", "--raw", sweepScript(selector, mutateContent));
  const result = JSON.parse(raw);
  if (result.error) {
    throw new Error(`measure-section-fit: ${label} — ${result.error}`);
  }
  const regimes = result.regimes.map((regime) => ({
    minContentWidth: round6(regime.minContentWidth),
    contentHeight: round6(regime.contentHeight),
  }));
  validateRegimes(label, regimes);
  return regimes;
}

function formatRegimes(regimes) {
  return regimes
    .map(
      (regime) =>
        `      { minContentWidth: ${regime.minContentWidth}, contentHeight: ${regime.contentHeight} },`,
    )
    .join("\n");
}

function formatOrientation(byOrientation) {
  return ORIENTATIONS.map(
    (orientation) => `      ${orientation.key}: [
${formatRegimes(byOrientation[orientation.key])}
      ],`,
  ).join("\n");
}

function renderFile(fit) {
  return `/* Generated by \`npm run measure:fit\` — DO NOT hand-edit; re-run the script instead.
   Source: ${route}, selector ${JSON.stringify(selector)}.
   DESIGN.md → Foundations → Layout → \`mounted-sheet\` → Measured per section. */

import type { MeasuredFit } from "@/components/layout/mounted-sheet-frame";

export const ${exportName}: MeasuredFit = {
  section: ${JSON.stringify(section)},
  regimes: {
    mobile: {
${formatOrientation(fit.mobile)}
    },
    tablet: {
${formatOrientation(fit.tablet)}
    },
    desktop: {
${formatOrientation(fit.desktop)}
    },
    wide: {
${formatOrientation(fit.wide)}
    },
  },
};
`;
}

const server = await ensureDevServer();

try {
  cli("open", `${ORIGIN}${route}`);

  const fit = {};
  for (const tier of TIERS) {
    fit[tier.key] = {};
    for (const orientation of ORIENTATIONS) {
      /* Falsified on mobile only: enough to prove the bisection catches a real content change. */
      const mutateContent = falsify && tier.key === "mobile";
      fit[tier.key][orientation.key] = await measureTierOrientation(
        tier,
        orientation,
        mutateContent,
      );
    }
  }

  console.log(`\nMeasured fit for "${section}" (${route}, ${selector}):`);
  for (const tier of TIERS) {
    for (const orientation of ORIENTATIONS) {
      console.log(`  ${tier.key} ${orientation.key}:`);
      for (const regime of fit[tier.key][orientation.key]) {
        console.log(`    ${regime.minContentWidth} -> ${regime.contentHeight}`);
      }
    }
  }

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, renderFile(fit), "utf8");
  console.log(`\nWrote ${outPath}`);
} finally {
  try {
    cli("close");
  } catch (error) {
    console.error(`cleanup: close failed — ${error.message}`);
  }
  if (server !== null) {
    safeKill(server.pid, "dev server");
  }
}
