import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { TestContext } from "node:test";

/* The source the static export is built from. The design-system gallery is `.dev.tsx` and never
   exported, so an edit there cannot make `out/` stale. */
const SOURCE_ROOTS = ["app", "components", "content"];
const EXCLUDED = ["app/design-system"];

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
): boolean {
  if (!existsSync(page)) {
    t.skip("no static export: run `npm run build` first");
    return false;
  }
  const newest = newestSource(roots, excluded);
  if (newest.mtimeMs > statSync(page).mtimeMs) {
    throw new Error(
      `stale static export: ${newest.path} changed after out/ was built; run \`npm run build\``,
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
    t.skip(
      "the export has no /thread: build it with `VERCEL_ENV=preview npm run build`",
    );
    return false;
  }
  return freshExport(t, page, roots, excluded);
}
