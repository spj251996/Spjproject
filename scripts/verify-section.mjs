#!/usr/bin/env node
/* Section verification harness for Phase 4.

   Drives the project's own `playwright-cli` devDependency rather than importing `playwright-core`,
   which is present only as a transitive dependency of it and would break the moment the CLI's own
   dependency tree changed.

   Usage:  npm run verify:section -- /
           npm run verify:section -- /preview --widths=390,1440

   `run-code` evaluates in the RUNNER context, where `page` exists and `document` does not, so every
   page-context read below is wrapped in `page.evaluate`. */

import { spawn, spawnSync } from "node:child_process";

const ORIGIN = "http://localhost:3000";
const SESSION = "verify";
const HEIGHT = 900;
const DEFAULT_WIDTHS = [320, 768, 1440];

const args = process.argv.slice(2);
const route = args.find((arg) => arg.startsWith("/")) ?? "/";
const widthsArg = args.find((arg) => arg.startsWith("--widths="));
const widths = widthsArg
  ? widthsArg.slice("--widths=".length).split(",").map(Number)
  : DEFAULT_WIDTHS;

function cli(...cliArgs) {
  const result = spawnSync(
    "npx",
    ["playwright-cli", `-s=${SESSION}`, ...cliArgs],
    {
      encoding: "utf8",
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `playwright-cli ${cliArgs[0]} failed:\n${result.stderr || result.stdout}`,
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

/* Returns the spawned child when this script started the server, null when one was already up —
   so a server the operator is running is never torn down underneath them. */
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
  process.kill(-child.pid);
  throw new Error("dev server did not answer within 60s");
}

/* Contrast is resolved against the nearest ancestor carrying an opaque background, which is how the
   mounted-sheet stack actually paints: the sheet holds the fill and the text sits several levels
   inside it. Translucent backgrounds are skipped rather than composited — a wrong composite reads as
   a real finding and costs more than the miss. */
const PROBE = `async () => await page.evaluate(() => {
  const parse = (color) => {
    const parts = color.match(/[\\d.]+/g);
    if (!parts) return null;
    const [r, g, b, a] = parts.map(Number);
    if (a !== undefined && a < 1) return null;
    return [r, g, b];
  };
  const luminance = ([r, g, b]) => {
    const channel = (value) => {
      const s = value / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };
  const ratio = (fg, bg) => {
    const a = luminance(fg);
    const b = luminance(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  const backdrop = (element) => {
    let node = element;
    while (node) {
      const found = parse(getComputedStyle(node).backgroundColor);
      if (found) return found;
      node = node.parentElement;
    }
    return [255, 255, 255];
  };
  const ownText = (element) =>
    Array.from(element.childNodes)
      .filter((node) => node.nodeType === 3)
      .map((node) => node.textContent.trim())
      .join(" ")
      .trim();

  const contrast = [];
  for (const element of document.body.querySelectorAll("*")) {
    const text = ownText(element);
    if (text === "") continue;
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") continue;
    if (Number(style.opacity) === 0) continue;
    const fg = parse(style.color);
    if (fg === null) continue;
    const size = Number.parseFloat(style.fontSize);
    const bold = Number(style.fontWeight) >= 700;
    const threshold = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
    const measured = ratio(fg, backdrop(element));
    if (measured < threshold) {
      contrast.push({
        tag: element.tagName.toLowerCase(),
        cls: String(element.className).slice(0, 48),
        size,
        ratio: Number(measured.toFixed(2)),
        threshold,
        text: text.slice(0, 40),
      });
    }
  }

  return {
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    contrast,
  };
})`;

const server = await ensureDevServer();
let clean = true;

try {
  cli("open", `${ORIGIN}${route}`);

  for (const width of widths) {
    cli("resize", String(width), String(HEIGHT));
    cli("reload");
    const probe = JSON.parse(cli("run-code", "--raw", PROBE));
    const overflows = probe.scrollWidth > probe.clientWidth;

    console.log(`\n${route} @ ${width}px`);
    console.log(
      `  overflow   ${overflows ? `FAIL  scrollWidth ${probe.scrollWidth} > clientWidth ${probe.clientWidth}` : "ok"}`,
    );
    if (probe.contrast.length === 0) {
      console.log("  contrast   ok");
    } else {
      console.log(`  contrast   ${probe.contrast.length} below threshold`);
      for (const finding of probe.contrast) {
        console.log(
          `    ${finding.ratio}:1 (needs ${finding.threshold}) ${finding.size}px <${finding.tag}> "${finding.text}" [${finding.cls}]`,
        );
      }
    }
    cli("screenshot");
    if (overflows) {
      clean = false;
    }
  }

  const consoleOut = cli("console", "error");
  const errors = Number(consoleOut.match(/Errors: (\\d+)/)?.[1] ?? "0");
  console.log(`\npage errors  ${errors === 0 ? "ok" : `FAIL  ${errors}`}`);
  if (errors > 0) {
    console.log(cli("console", "error", "--raw"));
    clean = false;
  }
} finally {
  cli("close");
  if (server !== null) {
    process.kill(-server.pid);
  }
}

/* Contrast findings do not fail the run. The gold exception (DESIGN.md -> Foundations -> Colors) is
   legitimately below AA at 2.39:1 for the eyebrow and the engraved rule's label, so a machine cannot
   tell an accepted exception from a defect. The list is printed for a human to judge against the
   exception's stated scope. Overflow and page errors have no such exception and do fail. */
console.log(`\nScreenshots in .playwright-cli/ (gitignored).`);
process.exit(clean ? 0 : 1);
