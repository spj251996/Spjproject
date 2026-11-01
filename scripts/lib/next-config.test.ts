import assert from "node:assert/strict";
import test from "node:test";
import {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_BUILD,
} from "next/constants.js";
import { pageExtensionsFor } from "../../next.config.ts";

/* Only the dev server and VERCEL_ENV exactly "preview" build the `.dev.tsx` pages; NODE_ENV has no say. */

test("the dev server builds both lab routes", () => {
  assert.deepEqual(pageExtensionsFor(PHASE_DEVELOPMENT_SERVER, {}), [
    "dev.tsx",
    "tsx",
    "ts",
  ]);
});

test("a preview build carries both lab routes", () => {
  assert.deepEqual(
    pageExtensionsFor(PHASE_PRODUCTION_BUILD, { VERCEL_ENV: "preview" }),
    ["dev.tsx", "tsx", "ts"],
  );
});

test("a production build carries neither, whatever else VERCEL_ENV says", () => {
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
      pageExtensionsFor(PHASE_PRODUCTION_BUILD, { VERCEL_ENV }),
      ["tsx", "ts"],
      `VERCEL_ENV=${JSON.stringify(VERCEL_ENV)}`,
    );
  }
});

test("a production build carries neither, whatever NODE_ENV says", () => {
  for (const NODE_ENV of [undefined, "development", "test", "production"]) {
    assert.deepEqual(
      pageExtensionsFor(PHASE_PRODUCTION_BUILD, { NODE_ENV }),
      ["tsx", "ts"],
      `NODE_ENV=${JSON.stringify(NODE_ENV)}`,
    );
  }
});
