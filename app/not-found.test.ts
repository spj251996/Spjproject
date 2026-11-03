import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { credit } from "../content/index.ts";
import { FIT_CONTENT } from "../scripts/lib/fit-content.ts";

/* Read from source because `not-found.tsx` is JSX, which `node --test` cannot load. */
const SOURCE = readFileSync("app/not-found.tsx", "utf8");

const classesOf = (pattern: RegExp, what: string) => {
  const found = SOURCE.match(pattern)?.[1];
  assert.ok(found, `no ${what} in not-found.tsx`);
  return found.split(" ");
};

/* The sign-off sits in the stack's flow so a short phone cannot put it over the action, and the
   empty first track mirrors the last so the eyebrow, heading and action stay centred in the card
   (DESIGN.md → Domain Components → Not found). */
test("the not-found stack keeps its group centred and signs off at the foot", () => {
  const stack = classesOf(
    /<div\s+className="([^"]+)"\s+data-not-found-stack/,
    "data-not-found-stack element",
  );
  for (const name of ["grid", "grow", "w-full", "grid-rows-[1fr_auto_1fr]"]) {
    assert.ok(stack.includes(name), `the stack lacks ${name}`);
  }

  const group = classesOf(
    /<div className="([^"]*row-start-2[^"]*)">/,
    "middle-track group",
  );
  assert.ok(group.includes("row-start-2"));
  const groupStart = SOURCE.indexOf(group.join(" "));
  const signoffStart = SOURCE.indexOf('<DesignerCredit layout="signoff" />');
  assert.ok(signoffStart > 0, "no signoff credit");
  const groupBody = SOURCE.slice(groupStart, signoffStart);
  for (const piece of ["type-eyebrow", "<h1", "<ButtonAction"]) {
    assert.ok(groupBody.includes(piece), `${piece} is not in the middle track`);
  }

  const foot = classesOf(
    /<div className="([^"]*row-start-3[^"]*)">\s*<DesignerCredit layout="signoff" \/>/,
    "last-track credit",
  );
  for (const name of ["row-start-3", "self-end", "mt-space-2xl"]) {
    assert.ok(foot.includes(name), `the credit's track lacks ${name}`);
  }
  assert.equal(SOURCE.match(/<DesignerCredit\b/g)?.length, 1);
});

test("the not-found fit is keyed to the credit it now renders", () => {
  assert.deepEqual(FIT_CONTENT["not-found"], { credit });
});
