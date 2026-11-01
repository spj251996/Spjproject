import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import test from "node:test";
import { galleryVerdict, LAB_OUTPUTS, labForbidden } from "./lab-routes.mjs";

const GALLERY_HTML =
  '<head><meta name="robots" content="noindex, nofollow"/></head><h1 class="type-heading-xl">Design System</h1>';

test("a default build forbids every output of both lab routes", () => {
  assert.deepEqual(labForbidden(false), LAB_OUTPUTS);
  for (const route of ["thread", "design-system"]) {
    for (const path of [
      `out/${route}.html`,
      `out/${route}.txt`,
      `out/${route}`,
    ]) {
      assert.ok(LAB_OUTPUTS.includes(path), `${path} is not forbidden`);
    }
  }
});

test("a preview build forbids no lab output", () => {
  assert.deepEqual(labForbidden(true), []);
});

test("every lab output a preview export emits at out/'s root is listed", (t) => {
  if (!existsSync("out/thread.html")) {
    t.skip(
      "the export has no /thread: build it with `VERCEL_ENV=preview npm run build`",
    );
    return;
  }
  const emitted = readdirSync("out")
    .filter((name) => /^(thread|design-system)(\.|$)/.test(name))
    .map((name) => `out/${name}`);
  assert.ok(emitted.length > 0, "no lab output found in out/");
  assert.deepEqual(
    emitted.filter((path) => !LAB_OUTPUTS.includes(path)),
    [],
  );
});

test("the gallery passes with its heading and one noindex, nofollow tag", () => {
  assert.equal(galleryVerdict(GALLERY_HTML).ok, true);
});

test("a 404 body in the gallery's place fails", () => {
  const notFound =
    '<meta name="robots" content="noindex"/><h1 class="next-error-h1">404</h1>';
  assert.equal(galleryVerdict(notFound).ok, false);
  assert.equal(galleryVerdict("").ok, false);
});

test("the gallery fails on a second robots tag or a weaker one", () => {
  const twice = GALLERY_HTML.replace(
    "</head>",
    '<meta name="robots" content="noindex, nofollow"/></head>',
  );
  assert.equal(galleryVerdict(twice).ok, false);
  assert.equal(
    galleryVerdict(GALLERY_HTML.replace("noindex, nofollow", "noindex")).ok,
    false,
  );
});
