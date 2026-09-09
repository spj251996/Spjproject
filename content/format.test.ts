import assert from "node:assert/strict";
import { test } from "node:test";
import { formatEventDate } from "./format.ts";

test("formats the wedding date", () => {
  assert.deepEqual(formatEventDate("2027-01-09"), {
    weekday: "Saturday",
    day: "9",
    ordinal: "th",
    month: "January",
    year: "2027",
  });
});

test("formats the engagement date", () => {
  assert.deepEqual(formatEventDate("2027-01-04"), {
    weekday: "Monday",
    day: "4",
    ordinal: "th",
    month: "January",
    year: "2027",
  });
});

test("picks the right ordinal for every irregular case", () => {
  const ord = (day: number) =>
    formatEventDate(`2027-01-${String(day).padStart(2, "0")}`).ordinal;
  assert.equal(ord(1), "st");
  assert.equal(ord(2), "nd");
  assert.equal(ord(3), "rd");
  assert.equal(ord(4), "th");
  assert.equal(ord(11), "th");
  assert.equal(ord(12), "th");
  assert.equal(ord(13), "th");
  assert.equal(ord(21), "st");
  assert.equal(ord(22), "nd");
  assert.equal(ord(23), "rd");
  assert.equal(ord(31), "st");
});

test("rejects a malformed date", () => {
  assert.throws(() => formatEventDate("9 Jan 2027"));
});
