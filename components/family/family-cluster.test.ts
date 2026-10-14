import assert from "node:assert/strict";
import { test } from "node:test";
import type { FamilyMember } from "../../content/types.ts";
import {
  flattenCluster,
  splitChildren,
  splitRoster,
} from "./family-cluster.ts";

function person(id: string, family: FamilyMember[] = []): FamilyMember {
  return { id, name: id, relationship: "Relation", portrait: null, family };
}

const ids = (members: FamilyMember[]) => members.map((member) => member.id);

test("the first two members are the parents, the rest the children in order", () => {
  const roster = splitRoster([
    person("mother"),
    person("father"),
    person("elder"),
    person("younger"),
  ]);
  assert.deepEqual(ids(roster.parents), ["mother", "father"]);
  assert.deepEqual(ids(roster.children), ["elder", "younger"]);
});

test("a roster of parents alone has no children row", () => {
  const roster = splitRoster([person("mother"), person("father")]);
  assert.deepEqual(ids(roster.parents), ["mother", "father"]);
  assert.deepEqual(ids(roster.children), []);
});

test("a roster without both parents is refused", () => {
  assert.throws(() => splitRoster([person("mother")]), /two parents/);
});

test("a member with no nested family flattens to themselves alone", () => {
  assert.deepEqual(ids(flattenCluster(person("sibling"))), ["sibling"]);
});

test("a member's spouse and children flatten onto one row, in content order", () => {
  const sister = person("sister", [person("spouse"), person("nephew")]);
  assert.deepEqual(ids(flattenCluster(sister)), ["sister", "spouse", "nephew"]);
});

test("children split into those with a family of their own and those without", () => {
  const split = splitChildren([
    person("sister", [person("spouse"), person("nephew")]),
    person("groom"),
  ]);
  assert.deepEqual(ids(split.clusters), ["sister"]);
  assert.deepEqual(ids(split.plain), ["groom"]);
});

/* A roster with a cluster and nothing else must render NO plain row. An empty row is a gap with no
   portraits in it, which reads as a layout bug and fails no other assertion. */
test("a roster of one cluster child has no plain row", () => {
  const split = splitChildren([person("sister", [person("spouse")])]);
  assert.deepEqual(ids(split.clusters), ["sister"]);
  assert.deepEqual(ids(split.plain), []);
});

test("two cluster children stay separate", () => {
  const split = splitChildren([
    person("elder", [person("elder-spouse")]),
    person("younger", [person("younger-spouse")]),
    person("groom"),
  ]);
  assert.deepEqual(ids(split.clusters), ["elder", "younger"]);
  assert.deepEqual(ids(split.plain), ["groom"]);
});

test("the bride's shape, two plain children and no cluster, is unchanged", () => {
  const split = splitChildren([person("bride"), person("brother")]);
  assert.deepEqual(ids(split.clusters), []);
  assert.deepEqual(ids(split.plain), ["bride", "brother"]);
});
