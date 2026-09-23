import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  ContactPerson,
  EventSegment,
  FamilyGroup,
  InviteContent,
  Ritual,
  WeddingEvent,
  WishesContent,
} from "./types.ts";
import {
  validateContacts,
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
  cityTown: "A Town",
  state: "A State",
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
  passage: "Text.",
  passageAttribution: "Book 1:1",
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

test("rejects an empty invite passage, naming the path", () => {
  assert.throws(
    () => validateInvite({ ...invite, passage: "" }),
    /invite\.passage/,
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

test("rejects an empty event state, naming the path", () => {
  assert.throws(
    () => validateEvents([event({ state: "" })]),
    /events\[0\]\.state must not be empty/,
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

const contact = (over: Partial<ContactPerson> = {}): ContactPerson => ({
  id: "bride-contact",
  side: "bride",
  name: "Amal",
  relationship: "Brother",
  phone: "+919354187793",
  ...over,
});

const contactPair = (): ContactPerson[] => [
  contact(),
  contact({
    id: "groom-contact",
    side: "groom",
    name: "Christopher",
    relationship: "Cousin",
    phone: "+919048054495",
  }),
];

test("accepts a well-formed contact pair", () => {
  assert.deepEqual(validateContacts(contactPair()), contactPair());
});

test("rejects a contact list without one of each side", () => {
  assert.throws(
    () => validateContacts([contact()]),
    /contacts must hold exactly one "bride"/,
  );
  assert.throws(
    () => validateContacts([contact(), contact({ id: "second" })]),
    /contacts must hold exactly one "bride"/,
  );
});

test("rejects a duplicate contact id, naming the path", () => {
  const pair = contactPair();
  pair[1].id = pair[0].id;
  assert.throws(
    () => validateContacts(pair),
    /contacts\[1\]\.id duplicates an earlier id/,
  );
});

test("rejects an empty contact name or relationship, naming the path", () => {
  assert.throws(
    () => validateContacts([contact({ name: "" }), contactPair()[1]]),
    /contacts\[0\]\.name/,
  );
  assert.throws(
    () => validateContacts([contact({ relationship: "" }), contactPair()[1]]),
    /contacts\[0\]\.relationship/,
  );
});

test("rejects a phone number that is not E.164", () => {
  for (const bad of [
    "9354187793",
    "+0 9354187793",
    /* No space, so this one fails on the leading zero alone — the case above it fails on the
       space and leaves the country-code rule unproven. */
    "+09354187793",
    "+91 93541 87793",
    "+91935418779312345",
    "+9135",
  ]) {
    assert.throws(
      () => validateContacts([contact({ phone: bad }), contactPair()[1]]),
      /contacts\[0\]\.phone must be an E\.164 number/,
      `expected "${bad}" to be rejected`,
    );
  }
});

test("accepts an E.164 number at both length bounds", () => {
  assert.doesNotThrow(() =>
    validateContacts([contact({ phone: "+12345678" }), contactPair()[1]]),
  );
  assert.doesNotThrow(() =>
    validateContacts([
      contact({ phone: "+123456789012345" }),
      contactPair()[1],
    ]),
  );
});
