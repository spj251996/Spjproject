import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  EventSegment,
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

const segment = (over: Partial<EventSegment> = {}): EventSegment => ({
  id: "s",
  label: "Church",
  time: "10:00 AM",
  venue: "V",
  address: "A",
  mapUrl: "https://x.test/m",
  ...over,
});

const event = (over: Partial<WeddingEvent> = {}): WeddingEvent => ({
  id: "e",
  name: "An Event",
  cityTown: "A Town",
  date: "2027-01-09",
  segments: [segment()],
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
  wishesLead: "With love",
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

test("rejects a duplicate segment id within one event", () => {
  assert.throws(
    () =>
      validateEvents([
        event({ segments: [segment(), segment({ label: "Reception" })] }),
      ]),
    /events\[0\]\.segments\[1\]\.id duplicates an earlier id \("s"\)/,
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

test("rejects a mapUrl whose scheme is not http(s)", () => {
  assert.throws(
    () =>
      validateEvents([
        event({ segments: [segment({ mapUrl: "javascript:alert(1)" })] }),
      ]),
    /events\[0\]\.segments\[0\]\.mapUrl must be an http\(s\) URL/,
  );
});

test("rejects an empty string in a nullable segment field", () => {
  const fields = ["time", "venue", "address", "mapUrl"] as const;
  for (const field of fields) {
    assert.throws(
      () => validateEvents([event({ segments: [segment({ [field]: "" })] })]),
      new RegExp(
        `events\\[0\\]\\.segments\\[0\\]\\.${field} must be null when absent, never an empty string`,
      ),
      `${field} accepted an empty string`,
    );
  }
});

test("rejects an empty string portrait", () => {
  assert.throws(
    () => validateFamilyGroups(pair({ members: [member({ portrait: "" })] })),
    /familyGroups\[0\]\.members\[0\]\.portrait must be null when absent, never an empty string/,
  );
});

test("rejects a family set that is not exactly one bride and one groom", () => {
  assert.throws(
    () => validateFamilyGroups([group()]),
    /exactly one "bride" group and one "groom" group \(got: bride\)/,
  );
  assert.throws(
    () => validateFamilyGroups([group(), group({ id: "g2" })]),
    /exactly one "bride" group and one "groom" group \(got: bride, bride\)/,
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
    /familyGroups\[0\]\.members\[0\]\.family\[0\]\.id duplicates an earlier id \("dup"\)/,
  );
});

/* Member ids are scoped to their own family group, so both sides may use "m" — see `claimId`. */
test("accepts the same member id on both sides", () => {
  assert.doesNotThrow(() => validateFamilyGroups(pair()));
});

test("accepts null in every nullable field", () => {
  const bare = event({
    segments: [
      segment({ time: null, venue: null, address: null, mapUrl: null }),
    ],
  });
  assert.doesNotThrow(() => validateEvents([bare]));
  assert.doesNotThrow(() =>
    validateFamilyGroups(
      pair({
        members: [
          member({
            portrait: null,
            family: [member({ id: "kid", portrait: null })],
          }),
        ],
      }),
    ),
  );
});

test("rejects empty invite copy, naming the field", () => {
  assert.throws(
    () => validateInvite({ ...invite, eyebrow: "" }),
    /invite\.eyebrow must not be empty/,
  );
  assert.throws(
    () => validateInvite({ ...invite, coupleNames: "   " }),
    /invite\.coupleNames must not be empty/,
  );
});

test("rejects empty wishes copy, naming the field", () => {
  assert.throws(
    () => validateWishes({ ...wishes, passage: "" }),
    /wishes\.passage must not be empty/,
  );
  assert.throws(
    () => validateWishes({ ...wishes, wishesLine: "   " }),
    /wishes\.wishesLine must not be empty/,
  );
});

test("validateWishes rejects a missing sign-off lead", () => {
  assert.throws(
    () =>
      validateWishes({
        passage: "Charity suffereth long.",
        passageAttribution: "1 Corinthians 13:4",
        coupleNames: "Flemy & Sebastian",
        wishesLead: "",
        wishesLine: "Marietta Joseph, Harry William & Amal Roy",
      }),
    /wishes\.wishesLead/,
  );
});
