import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { EventSegment, WeddingEvent } from "../../content/types.ts";
import { withClasses } from "../../scripts/lib/source-classes.ts";
import {
  mapLabel,
  segmentLineParts,
  sharedAddress,
  splitAddress,
  venueRuns,
} from "./event-info-text.ts";

const read = (path: string) => readFileSync(path, "utf8");

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
    "Get directions to Chinnas Auditorium",
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

test("Event Info is two columns at every tier, details left, map pill on the venue", () => {
  const eventInfo = read("app/_sections/event-info.tsx");
  assert.equal(
    withClasses(eventInfo, "grid-cols-[auto_minmax(0,auto)]").length,
    1,
  );
  assert.equal(withClasses(eventInfo, "grid-cols-1").length, 0);
  assert.ok(withClasses(eventInfo, "items-start", "text-left").length > 0);
  /* The pill's left edge is the target's own, so it sits on the venue's first letter with nothing
     pulling it back (owner, 2026-10-30) — the old disc layout's `-ms-space-sm` inset is gone. */
  const pill = eventInfo
    .split("<ButtonAction")
    .slice(1)
    .map((rest) => rest.slice(0, rest.indexOf("</ButtonAction>")))
    .filter((element) => element.includes('ground="pill"'));
  assert.equal(pill.length, 1, "Event Info carries one map action");
  assert.ok(
    pill[0].includes('className="mt-space-2xs"'),
    "the pill gained a class that moves its left edge",
  );
  assert.equal(withClasses(eventInfo, "-ms-space-sm").length, 0);
});

test("the 2026-10-14 picks: Event Info's natural phone rhythm", () => {
  const eventInfo = readFileSync("app/_sections/event-info.tsx", "utf8");
  for (const cls of [
    "[@media(width<48rem)]:mt-[calc(var(--spacing-space-sm)+2.5px)]",
    "mt-[calc(var(--spacing-space-lg)+2px)]",
    "gap-y-[calc(var(--spacing-space-md)+2px)]",
  ]) {
    assert.ok(eventInfo.includes(cls), `Event Info lost ${cls}`);
  }
});
