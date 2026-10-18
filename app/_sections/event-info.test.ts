import assert from "node:assert/strict";
import test from "node:test";
import type { EventSegment, WeddingEvent } from "../../content/types.ts";
import {
  mapLabel,
  segmentLineParts,
  sharedAddress,
  splitAddress,
  venueRuns,
} from "./event-info-text.ts";

const segment = (overrides: Partial<EventSegment> = {}): EventSegment => ({
  id: "wedding-church",
  label: "Holy Matrimony",
  time: "10:00 AM",
  venue: "St. Antony's Syro-Malabar Church",
  address: "Paroppadi, Kozhikode, Kerala",
  mapUrl: "https://maps.app.goo.gl/example",
  ...overrides,
});

const event = (segments: EventSegment[]): WeddingEvent => ({
  id: "wedding",
  state: "Kerala",
  date: "2027-01-09",
  segments,
});

test("the map action is named by its visible label, then the venue", () => {
  assert.equal(
    mapLabel(segment({ venue: "Chinnas Auditorium" })),
    "Meet us here, Chinnas Auditorium",
  );
});

test("a map action with no venue to name refuses to render", () => {
  assert.throws(
    () => mapLabel(segment({ venue: null })),
    /segment "wedding-church" has a map link but no venue/,
  );
});

test("a hyphenated venue word is kept whole and the rest of the venue is kept", () => {
  const venue = "Syro-Malabar Church, Ernakulam";
  const runs = venueRuns(venue);
  assert.deepEqual(runs, [
    { text: "Syro-Malabar", nowrap: true },
    { text: " Church, Ernakulam", nowrap: false },
  ]);
  assert.equal(runs.map((run) => run.text).join(""), venue);
});

test("every hyphenated word is kept whole, wherever it sits", () => {
  const venue = "St. Antony's Syro-Malabar Church-Hall";
  const runs = venueRuns(venue);
  assert.deepEqual(runs, [
    { text: "St. Antony's ", nowrap: false },
    { text: "Syro-Malabar", nowrap: true },
    { text: " ", nowrap: false },
    { text: "Church-Hall", nowrap: true },
  ]);
  assert.equal(runs.map((run) => run.text).join(""), venue);
});

test("a venue with no hyphenated word is one breakable run", () => {
  assert.deepEqual(venueRuns("Chinnas Auditorium"), [
    { text: "Chinnas Auditorium", nowrap: false },
  ]);
});

test("the address breaks after its first comma's space, with the rest unbreakable", () => {
  assert.deepEqual(splitAddress("Paroppadi, Kozhikode, Kerala"), {
    head: "Paroppadi, ",
    tail: "Kozhikode, Kerala",
  });
});

test("an address with no comma has nothing to hold together", () => {
  assert.deepEqual(splitAddress("Kozhikode"), {
    head: "Kozhikode",
    tail: null,
  });
});

test("a timed segment line has its time and the spoken comma in the diamond's place", () => {
  assert.deepEqual(segmentLineParts(segment()), {
    time: "10:00 AM",
    spokenSeparator: ", ",
    label: "Holy Matrimony",
  });
});

test("an untimed segment line has no time part and no spoken comma", () => {
  assert.deepEqual(segmentLineParts(segment({ time: null })), {
    time: null,
    spokenSeparator: null,
    label: "Holy Matrimony",
  });
});

test("the sheet header names the one address every segment shares", () => {
  assert.equal(
    sharedAddress(event([segment(), segment({ id: "wedding-reception" })])),
    "Paroppadi, Kozhikode, Kerala",
  );
});

test("segments at different addresses refuse a shared header", () => {
  assert.throws(
    () =>
      sharedAddress(
        event([
          segment(),
          segment({ address: "Koothattukulam, Ernakulam, Kerala" }),
        ]),
      ),
    /different addresses/,
  );
});

test("an event with no address refuses a header", () => {
  assert.throws(
    () => sharedAddress(event([segment({ address: null })])),
    /has no address/,
  );
});
