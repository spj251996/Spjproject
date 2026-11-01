import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { TestContext } from "node:test";

/* The source the static export is built from. The design-system gallery is `.dev.tsx`: a default build never
   exports it and no lab test reads its page, so an edit there cannot make a page these tests read stale. */
const SOURCE_ROOTS = ["app", "components", "content"];
const EXCLUDED = ["app/design-system"];
const PREVIEW_BUILD = "VERCEL_ENV=preview npm run build";

function newestSource(
  roots: readonly string[],
  excluded: readonly string[],
): { path: string; mtimeMs: number } {
  let newest = { path: "", mtimeMs: 0 };
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (excluded.includes(path)) continue;
      if (entry.isDirectory()) walk(path);
      else if (!/\.test\.[cm]?[jt]sx?$/.test(entry.name)) {
        const { mtimeMs } = statSync(path);
        if (mtimeMs > newest.mtimeMs) newest = { path, mtimeMs };
      }
    }
  };
  for (const root of roots) if (existsSync(root)) walk(root);
  return newest;
}

/** Whether a test that reads the static export may run. No export (a fresh clone): skipped, false. An
    export older than the source it was built from: throws, so a stale `out/` can never pass for the
    current tree. */
export function freshExport(
  t: Pick<TestContext, "skip">,
  page = "out/index.html",
  roots: readonly string[] = SOURCE_ROOTS,
  excluded: readonly string[] = EXCLUDED,
  rebuild = "npm run build",
): boolean {
  if (!existsSync(page)) {
    t.skip(`no static export: run \`${rebuild}\` first`);
    return false;
  }
  const newest = newestSource(roots, excluded);
  if (newest.mtimeMs > statSync(page).mtimeMs) {
    throw new Error(
      `stale static export: ${newest.path} changed after out/ was built; run \`${rebuild}\``,
    );
  }
  return true;
}

/** Whether a test that reads the thread lab's export may run. `/thread` is built only for Vercel previews and dev,
    so a default build has no `out/thread.html` and no thread script in its chunks: skipped, naming the build
    that has them. Otherwise the same freshness rule as `freshExport`. */
export function labExport(
  t: Pick<TestContext, "skip">,
  page = "out/thread.html",
  roots: readonly string[] = SOURCE_ROOTS,
  excluded: readonly string[] = EXCLUDED,
): boolean {
  if (!existsSync(page)) {
    t.skip(`the export has no /thread: build it with \`${PREVIEW_BUILD}\``);
    return false;
  }
  return freshExport(t, page, roots, excluded, PREVIEW_BUILD);
}
