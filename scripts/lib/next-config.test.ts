import assert from "node:assert/strict";
import test from "node:test";
import { pageExtensionsFor } from "../../next.config.ts";

/* The gallery and the thread lab (both `page.dev.tsx`) are built for dev and Vercel previews only. A production
   build is the default: anything but the exact string "preview" builds neither. */

test("dev builds both lab routes", () => {
  assert.deepEqual(pageExtensionsFor({ NODE_ENV: "development" }), [
    "dev.tsx",
    "tsx",
    "ts",
  ]);
});

test("a preview build carries both lab routes", () => {
  assert.deepEqual(
    pageExtensionsFor({ NODE_ENV: "production", VERCEL_ENV: "preview" }),
    ["dev.tsx", "tsx", "ts"],
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
