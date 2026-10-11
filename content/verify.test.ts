import assert from "node:assert/strict";
import { test } from "node:test";
import type { FamilyGroup, FamilyMember } from "./types.ts";
import {
  type AssetReference,
  collectAssetPaths,
  MissingAssetError,
  UnknownRitualDirectoryError,
  unknownRitualDirectories,
  verifyAssetPaths,
  verifyRitualDirectories,
} from "./verify.ts";

const member = (over: Partial<FamilyMember> = {}): FamilyMember => ({
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

const content = (over: Partial<{ familyGroups: FamilyGroup[] }> = {}) => ({
  familyGroups: [],
  ...over,
});

const pathsOf = (references: AssetReference[]) =>
  references.map((reference) => reference.path);

/** Stands in for `fs.existsSync` — only the listed paths are on disk. */
const onDisk =
  (present: string[]) =>
  (assetPath: string): boolean =>
    present.includes(assetPath);

test("collects every portrait, including ones nested inside family[]", () => {
  const sibling = member({
    id: "sib",
    portrait: "/family/sib.jpg",
    family: [
      member({
        id: "spouse",
        portrait: "/family/spouse.jpg",
        family: [member({ id: "kid", portrait: "/family/kid.jpg" })],
      }),
    ],
  });
  const references = collectAssetPaths(
    content({
      familyGroups: [
        group({
          members: [member({ portrait: "/family/mother.jpg" }), sibling],
        }),
      ],
    }),
  );
  assert.deepEqual(pathsOf(references), [
    "/family/mother.jpg",
    "/family/sib.jpg",
    "/family/spouse.jpg",
    "/family/kid.jpg",
  ]);
  assert.equal(
    references[2].at,
    "familyGroups[0].members[1].family[0].portrait",
  );
});

/* A null portrait is a member with no photo, not a broken path — nothing to look for on disk. */
test("collects nothing from a null portrait", () => {
  assert.deepEqual(collectAssetPaths(content({ familyGroups: [group()] })), []);
});

test("passes when every path exists", () => {
  const references = collectAssetPaths(
    content({
      familyGroups: [
        group({ members: [member({ portrait: "/family/a.jpg" })] }),
      ],
    }),
  );
  assert.doesNotThrow(() =>
    verifyAssetPaths(
      references,
      onDisk(["/family/a.jpg", "/family/unused.jpg"]),
    ),
  );
});

test("passes when there is nothing to check", () => {
  assert.doesNotThrow(() => verifyAssetPaths([], onDisk([])));
});

test("throws naming the missing path and where it was expected on disk", () => {
  const check = () =>
    verifyAssetPaths(
      [
        { at: "familyGroups[0].members[0].portrait", path: "/family/nope.jpg" },
        { at: "familyGroups[0].members[1].portrait", path: "/family/here.jpg" },
      ],
      onDisk(["/family/here.jpg"]),
    );
  assert.throws(check, MissingAssetError);
  assert.throws(
    check,
    /familyGroups\[0\]\.members\[0\]\.portrait — "\/family\/nope\.jpg" \(expected at public\/family\/nope\.jpg\)/,
  );
});

test("leaves an existing path out of the message", () => {
  assert.throws(
    () =>
      verifyAssetPaths(
        [
          {
            at: "familyGroups[0].members[1].portrait",
            path: "/family/here.jpg",
          },
          {
            at: "familyGroups[0].members[2].portrait",
            path: "/family/nope.jpg",
          },
        ],
        onDisk(["/family/here.jpg"]),
      ),
    (error: unknown) => {
      assert.ok(error instanceof MissingAssetError);
      assert.doesNotMatch(error.message, /here\.jpg/);
      return true;
    },
  );
});

/* One build, one list — a content editor should not have to fix a typo, rebuild, and find the next. */
test("names every missing path in a single message", () => {
  assert.throws(
    () =>
      verifyAssetPaths(
        [
          {
            at: "familyGroups[0].members[0].portrait",
            path: "/family/one.jpg",
          },
          {
            at: "familyGroups[1].members[2].portrait",
            path: "/family/two.jpg",
          },
          {
            at: "familyGroups[2].members[0].portrait",
            path: "/family/three.jpg",
          },
        ],
        onDisk([]),
      ),
    (error: unknown) => {
      assert.ok(error instanceof MissingAssetError);
      assert.match(error.message, /do not exist on disk \(3\)/);
      for (const missing of [
        "public/family/one.jpg",
        "public/family/two.jpg",
        "public/family/three.jpg",
      ]) {
        assert.ok(
          error.message.includes(missing),
          `${missing} missing from the message`,
        );
      }
      return true;
    },
  );
});

test("a ritual directory whose name matches no ritual id is reported", () => {
  assert.deepEqual(
    unknownRitualDirectories(
      ["wedding-eve", "wedding_eve"],
      ["wedding-eve", "betrothal"],
    ),
    ["wedding_eve"],
  );
});

test("every directory matching a ritual id is accepted", () => {
  assert.deepEqual(
    unknownRitualDirectories(
      ["betrothal", "wedding-eve"],
      ["wedding-eve", "betrothal"],
    ),
    [],
  );
});

test("a ritual with no directory is not an error", () => {
  /* The absence of photographs is the shipping state: a ritual shows its strip when it has files
     and by nothing else. Only the reverse — a directory nothing reads — is a mistake. */
  assert.deepEqual(unknownRitualDirectories([], ["wedding-eve"]), []);
});

test("an unknown ritual directory throws naming it and the ids it could have meant", () => {
  assert.throws(
    () =>
      verifyRitualDirectories(["wedding_eve"], ["wedding-eve", "betrothal"]),
    (error: unknown) => {
      assert.ok(error instanceof UnknownRitualDirectoryError);
      assert.match(error.message, /wedding_eve/);
      assert.match(error.message, /wedding-eve/);
      assert.match(error.message, /betrothal/);
      return true;
    },
  );
});
