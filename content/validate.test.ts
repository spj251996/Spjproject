import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  FamilyGroup,
  InviteContent,
  Ritual,
  WeddingEvent,
  WishesContent,
} from "./types.ts";
import {
  validateEvents,
  validateFamilyGroups,
  validateInvite,
  validateRituals,
  validateWishes,
} from "./validate.ts";

const ritual = (over: Partial<Ritual> = {}): Ritual => ({
  id: "a",
  title: "A Ritual",
  description: "What happens.",
  status: "upcoming",
  images: [],
  ...over,
});

const event = (over: Partial<WeddingEvent> = {}): WeddingEvent => ({
  id: "e",
  name: "An Event",
  cityTown: "A Town",
  date: "2027-01-09",
  segments: [
    {
      id: "s",
      label: "Church",
      time: "10:00 AM",
      venue: "V",
      address: "A",
      mapUrl: "https://x.test/m",
    },
  ],
  ...over,
});

const member = (over: Partial<FamilyGroup["members"][0]> = {}) => ({
  id: "m",
  name: "A Name",
  relationship: "Mother",
  portrait: null,
  family: [],
  ...over,
});

const group = (over: Partial<FamilyGroup> = {}): FamilyGroup => ({
  id: "g",
  side: "bride",
  familyName: "A Family",
  members: [member()],
  ...over,
});

const pair = (over: Partial<FamilyGroup> = {}) => [
  group(over),
  group({ id: "g2", side: "groom" }),
];

const invite: InviteContent = {
  eyebrow: "We are getting married",
  coupleNames: "A & B",
};

const wishes: WishesContent = {
  passage: "Text.",
  passageAttribution: "Book 1:1",
  coupleNames: "A & B",
  wishesLine: "Best compliments from C.",
};

test("accepts well-formed content", () => {
  assert.deepEqual(validateRituals([ritual()]), [ritual()]);
  assert.deepEqual(validateEvents([event()]), [event()]);
  assert.deepEqual(validateFamilyGroups(pair()), pair());
  assert.deepEqual(validateInvite(invite), invite);
  assert.deepEqual(validateWishes(wishes), wishes);
});

test("rejects an empty required string, naming the path", () => {
  assert.throws(
    () => validateRituals([ritual({ title: "" })]),
    /rituals\[0\]\.title/,
  );
});

test("rejects a duplicate id", () => {
  assert.throws(
    () => validateRituals([ritual(), ritual()]),
    /rituals\[1\]\.id/,
  );
});

test("rejects a whitespace-only id", () => {
  assert.throws(
    () => validateRituals([ritual({ id: "  " })]),
    /rituals\[0\]\.id/,
  );
});

test("rejects an empty image entry", () => {
  assert.throws(
    () => validateRituals([ritual({ images: [""] })]),
    /rituals\[0\]\.images\[0\]/,
  );
});

test("rejects a non-ISO date", () => {
  assert.throws(
    () => validateEvents([event({ date: "9 Jan 2027" })]),
    /events\[0\]\.date/,
  );
});

test("rejects a shape-valid but unreal date", () => {
  assert.throws(
    () => validateEvents([event({ date: "2027-02-30" })]),
    /events\[0\]\.date/,
  );
});

test("rejects an event with no segments", () => {
  assert.throws(
    () => validateEvents([event({ segments: [] })]),
    /events\[0\]\.segments/,
  );
});

test("rejects a relative mapUrl", () => {
  const bad = event();
  bad.segments[0].mapUrl = "/maps";
  assert.throws(
    () => validateEvents([bad]),
    /events\[0\]\.segments\[0\]\.mapUrl/,
  );
});

test("rejects a family set that is not exactly one bride and one groom", () => {
  assert.throws(() => validateFamilyGroups([group()]), /familyGroups/);
  assert.throws(
    () => validateFamilyGroups([group(), group({ id: "g2" })]),
    /familyGroups/,
  );
});

test("rejects a group with no members", () => {
  assert.throws(
    () => validateFamilyGroups(pair({ members: [] })),
    /familyGroups\[0\]\.members/,
  );
});

test("rejects a portrait path that is not root-relative", () => {
  assert.throws(
    () =>
      validateFamilyGroups(
        pair({ members: [member({ portrait: "family/x.jpg" })] }),
      ),
    /familyGroups\[0\]\.members\[0\]\.portrait/,
  );
});

test("recurses into a nested family member", () => {
  const nested = member({
    id: "sib",
    family: [member({ id: "spouse", name: "" })],
  });
  assert.throws(
    () => validateFamilyGroups(pair({ members: [nested] })),
    /familyGroups\[0\]\.members\[0\]\.family\[0\]\.name/,
  );
});

test("rejects an id duplicated between a member and a nested member", () => {
  const nested = member({ id: "dup", family: [member({ id: "dup" })] });
  assert.throws(
    () => validateFamilyGroups(pair({ members: [nested] })),
    /familyGroups\[0\]/,
  );
});

test("accepts null for every optional field", () => {
  assert.doesNotThrow(() => validateFamilyGroups(pair()));
});
