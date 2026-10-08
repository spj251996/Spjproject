/* The order lives in five places and the real failure is flipping four of them. Asserting any one
   site would be a tautology; asserting that all five AGREE is the claim worth making.

   `content/family.ts` is deliberately out of scope: "Flemy" and "Sebastian" appear there as roster
   members on two different sheets, not as an ordered pair. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { invite } from "./invite.ts";
import { wishes } from "./wishes.ts";

const GROOM = "Sebastian";
const BRIDE = "Flemy";

/* Returns the two names in the order they appear, for any string that mentions both. */
function order(text: string): [string, string] | null {
  const g = text.indexOf(GROOM);
  const b = text.indexOf(BRIDE);
  if (g === -1 || b === -1) return null;
  return g < b ? [GROOM, BRIDE] : [BRIDE, GROOM];
}

const layout = readFileSync("app/layout.tsx", "utf8");

/* The three metadata strings, matched on their field so a moved line does not break the test. */
const METADATA_SITES = [
  {
    label: "document title",
    value: layout.match(/^\s*title: "([^"]*)"/m)?.[1],
  },
  {
    label: "openGraph title",
    value: layout.match(/title: "([^"]*are getting married)"/)?.[1],
  },
  { label: "og image alt", value: layout.match(/alt: "([^"]*)"/)?.[1] },
];

test("all three metadata strings were actually found", () => {
  const missed = METADATA_SITES.filter((site) => site.value === undefined);
  assert.deepEqual(
    missed.map((site) => site.label),
    [],
    "a metadata string did not match — re-anchor this test rather than letting it pass over nothing",
  );
});

test("every site that names both leads with the groom", () => {
  const sites = [
    { label: "invite.coupleNames", value: invite.coupleNames },
    { label: "wishes.coupleNames", value: wishes.coupleNames },
    ...METADATA_SITES,
  ];
  const wrong = sites.filter((site) => order(site.value ?? "")?.[0] !== GROOM);
  assert.deepEqual(
    wrong.map((site) => site.label),
    [],
  );
});

test("both content fields split into exactly two names", () => {
  for (const value of [invite.coupleNames, wishes.coupleNames]) {
    assert.deepEqual(value.split(" & ").length, 2, value);
  }
});
