/* Writes every frame sheet in `app/frame-sheets.ts` to `app/frames/<name>.css`, and prunes any entry
   there that the list no longer names — `app/frames/` is wholly this script's. `--dry-run` lists what would
   be written and pruned and writes nothing. */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { pathToFileURL } from "node:url";
import {
  FRAME_SHEETS,
  FRAMES_DIR,
  type FrameSheet,
  frameSheetFile,
} from "../app/frame-sheets.ts";

/* Every sheet is generated before any is written, so a sheet that throws leaves the directory exactly
   as it was rather than half regenerated and unpruned. */
export function buildFrames(
  sheets: readonly FrameSheet[],
  dir: string,
  render: (sheet: FrameSheet) => string,
  {
    dryRun = false,
    log = console.log,
  }: { dryRun?: boolean; log?: (line: string) => void } = {},
): void {
  const files = sheets.map((sheet) => ({
    path: `${dir}/${sheet.name}.css`,
    next: render(sheet),
  }));
  if (!dryRun) mkdirSync(dir, { recursive: true });
  for (const { path, next } of files) {
    let current: string | null = null;
    try {
      current = readFileSync(path, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const verb =
      current === next ? "unchanged" : current === null ? "write" : "update";
    log(`${verb.padEnd(9)} ${path} (${next.length} bytes)`);
    if (!dryRun && verb !== "unchanged") writeFileSync(path, next);
  }
  const wanted = new Set(sheets.map((sheet) => `${sheet.name}.css`));
  for (const name of existsSync(dir) ? readdirSync(dir) : []) {
    if (!wanted.has(name)) {
      log(`prune     ${dir}/${name}`);
      if (!dryRun) rmSync(`${dir}/${name}`, { recursive: true });
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  buildFrames(FRAME_SHEETS, FRAMES_DIR, frameSheetFile, {
    dryRun: process.argv.includes("--dry-run"),
  });
}
