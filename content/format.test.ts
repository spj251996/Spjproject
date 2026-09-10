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
  assert.throws(() => formatEventDate("9 Jan 2027"), {
    name: "Error",
    message: /formatEventDate: expected a real calendar date.*"9 Jan 2027"/,
  });
});

/* `new Date("2027-02-30T00:00:00Z")` rolls over to 2 March instead of returning NaN, so this used to
   render a different day rather than fail. */
test("rejects a shape-valid but unreal date instead of rolling it over", () => {
  assert.throws(() => formatEventDate("2027-02-30"), {
    name: "Error",
    message: /formatEventDate: expected a real calendar date.*"2027-02-30"/,
  });
});

test("rejects an out-of-range month and day", () => {
  assert.throws(() => formatEventDate("2027-13-01"), {
    name: "Error",
    message: /"2027-13-01"/,
  });
  assert.throws(() => formatEventDate("2027-01-32"), {
    name: "Error",
    message: /"2027-01-32"/,
  });
});

test("accepts a real leap day and rejects a false one", () => {
  assert.equal(formatEventDate("2028-02-29").day, "29");
  assert.throws(() => formatEventDate("2027-02-29"), {
    name: "Error",
    message: /"2027-02-29"/,
  });
});
