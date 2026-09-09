import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { familyGroups, rituals } from "./index.ts";
import type { FamilyGroup, FamilyMember, Ritual } from "./types.ts";

/* The build-time half of content checking: `validate.ts` proves a path is well-formed, this proves the
   file behind it is really there. The two cannot live together — every content module imports the
   validators, so a `node:fs` import there would break any bundle that content reaches. Nothing in the
   app imports this module; only `npm run validate:content` and `prebuild` run it.

   Importing the barrel runs every validator, so one `node content/verify.ts` covers both gates. */

export class MissingAssetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingAssetError";
  }
}

/** One authored asset path, with the content location that carries it. */
export interface AssetReference {
  /** Where the path lives in the content — `familyGroups[0].members[0].portrait`. */
  at: string;
  /** The root-relative web path — `/family/flemy-roy.jpg`. */
  path: string;
}

/** Root-relative paths are served out of `public/`, so that is where they must exist on disk. */
function diskPath(assetPath: string): string {
  return `public${assetPath}`;
}

function collectPortraits(
  members: FamilyMember[],
  at: string,
  found: AssetReference[],
): void {
  members.forEach((member, index) => {
    const memberAt = `${at}[${index}]`;
    if (member.portrait !== null)
      found.push({ at: `${memberAt}.portrait`, path: member.portrait });
    collectPortraits(member.family, `${memberAt}.family`, found);
  });
}

export function collectAssetPaths(content: {
  familyGroups: FamilyGroup[];
  rituals: Ritual[];
}): AssetReference[] {
  const found: AssetReference[] = [];
  content.familyGroups.forEach((group, index) => {
    collectPortraits(group.members, `familyGroups[${index}].members`, found);
  });
  content.rituals.forEach((ritual, index) => {
    ritual.images.forEach((image, i) => {
      found.push({ at: `rituals[${index}].images[${i}]`, path: image });
    });
  });
  return found;
}

/** `exists` is injected so the check itself is testable without touching a filesystem. */
export function verifyAssetPaths(
  references: AssetReference[],
  exists: (assetPath: string) => boolean,
): void {
  const missing = references.filter((reference) => !exists(reference.path));
  if (missing.length === 0) return;
  /* Every missing path is listed, not just the first: the reader is a content editor reading a build
     log, and one round-trip per typo is one too many. */
  const lines = missing.map(
    (reference) =>
      `  ${reference.at} — "${reference.path}" (expected at ${diskPath(reference.path)})`,
  );
  throw new MissingAssetError(
    `Content asset check failed. These asset paths do not exist on disk (${missing.length}):\n${lines.join("\n")}`,
  );
}

const fileExists = (assetPath: string): boolean =>
  existsSync(new URL(`../${diskPath(assetPath)}`, import.meta.url));

/* Only running this file as an entry point touches disk — importing it (as the unit tests do) stays
   side-effect free. */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  verifyAssetPaths(collectAssetPaths({ familyGroups, rituals }), fileExists);
}
