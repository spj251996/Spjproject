import assert from "node:assert/strict";
import test from "node:test";
import { gridColumns } from "./gallery-control.ts";

test("one photograph takes one column, at two columns' width, centred", () => {
  assert.match(gridColumns(1), /\bcolumns-1\b/);
  assert.match(gridColumns(1), /\bmx-auto\b/);
  assert.doesNotMatch(gridColumns(1), /columns-[23]/);
});

test("two to four photographs take two columns at every tier", () => {
  for (const count of [2, 3, 4]) {
    assert.equal(gridColumns(count), "columns-2", `${count}`);
  }
});

test("five or more take two columns, three from the laptop tier", () => {
  for (const count of [5, 6, 12, 60]) {
    assert.equal(gridColumns(count), "columns-2 lg:columns-3", `${count}`);
  }
});
