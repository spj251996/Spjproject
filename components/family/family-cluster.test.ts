import assert from "node:assert/strict";
import { test } from "node:test";
import type { FamilyMember } from "../../content/types.ts";
import { splitCluster } from "./family-cluster.ts";

function person(id: string, family: FamilyMember[] = []): FamilyMember {
  return { id, name: id, relationship: "Relation", portrait: null, family };
}

const ids = (members: FamilyMember[]) => members.map((member) => member.id);

test("a member with no nested family stands alone", () => {
  const cluster = splitCluster(person("parent"));
  assert.deepEqual(ids(cluster.row), ["parent"]);
  assert.deepEqual(ids(cluster.children), []);
});

test("a spouse shares the sibling's row and a child sits beneath", () => {
  const cluster = splitCluster(
    person("sibling", [person("spouse"), person("child")]),
  );
  assert.deepEqual(ids(cluster.row), ["sibling", "spouse"]);
  assert.deepEqual(ids(cluster.children), ["child"]);
});

test("two children keep their birth order beneath", () => {
  const cluster = splitCluster(
    person("sibling", [person("spouse"), person("elder"), person("younger")]),
  );
  assert.deepEqual(ids(cluster.row), ["sibling", "spouse"]);
  assert.deepEqual(ids(cluster.children), ["elder", "younger"]);
});

test("a spouse with no child does not wrap", () => {
  const cluster = splitCluster(person("sibling", [person("spouse")]));
  assert.deepEqual(ids(cluster.row), ["sibling", "spouse"]);
  assert.deepEqual(ids(cluster.children), []);
});
