/* Writes every frame sheet in `app/frame-sheets.ts` to `app/frames/<name>.css`, and prunes any `.css`
   there that the list no longer names — `app/frames/` holds nothing else. `--dry-run` lists what would
   be written and pruned and writes nothing. */
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import {
  FRAME_SHEETS,
  FRAMES_DIR,
  frameSheetFile,
} from "../app/frame-sheets.ts";

const dryRun = process.argv.includes("--dry-run");
mkdirSync(FRAMES_DIR, { recursive: true });
const wanted = new Set(FRAME_SHEETS.map((sheet) => `${sheet.name}.css`));
for (const sheet of FRAME_SHEETS) {
  const path = `${FRAMES_DIR}/${sheet.name}.css`;
  const next = frameSheetFile(sheet);
  let current: string | null = null;
  try {
    current = readFileSync(path, "utf8");
  } catch {}
  const verb =
    current === next ? "unchanged" : current === null ? "write" : "update";
  console.log(`${verb.padEnd(9)} ${path} (${next.length} bytes)`);
  if (!dryRun && verb !== "unchanged") writeFileSync(path, next);
}
for (const name of readdirSync(FRAMES_DIR)) {
  if (name.endsWith(".css") && !wanted.has(name)) {
    console.log(`prune     ${FRAMES_DIR}/${name}`);
    if (!dryRun) rmSync(`${FRAMES_DIR}/${name}`);
  }
}
