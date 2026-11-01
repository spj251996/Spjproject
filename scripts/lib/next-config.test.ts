import assert from "node:assert/strict";
import test from "node:test";
import { pageExtensionsFor } from "../../next.config.ts";

/* `/thread` (`page.lab.tsx`) is built for Vercel previews and dev only, and the gallery (`page.dev.tsx`) for dev
   only. A production build is the default: anything but the exact string "preview" builds neither. */

test("dev builds both the gallery and the lab", () => {
  assert.deepEqual(pageExtensionsFor({ NODE_ENV: "development" }), [
    "dev.tsx",
    "lab.tsx",
    "tsx",
    "ts",
  ]);
});

test("a preview build carries the lab but never the gallery", () => {
  assert.deepEqual(
    pageExtensionsFor({ NODE_ENV: "production", VERCEL_ENV: "preview" }),
    ["lab.tsx", "tsx", "ts"],
  );
});

test("production builds neither, whatever else VERCEL_ENV says", () => {
  for (const VERCEL_ENV of [
    undefined,
    "",
    "production",
    "development",
    "Preview",
    " preview",
    "preview ",
  ]) {
    assert.deepEqual(
      pageExtensionsFor({ NODE_ENV: "production", VERCEL_ENV }),
      ["tsx", "ts"],
      `VERCEL_ENV=${JSON.stringify(VERCEL_ENV)}`,
    );
  }
});
