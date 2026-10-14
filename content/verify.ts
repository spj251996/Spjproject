import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { familyGroups, rituals } from "./index.ts";
import type { FamilyGroup, FamilyMember } from "./types.ts";

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

export class UnknownRitualDirectoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnknownRitualDirectoryError";
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

/* Portraits only. The ritual photographs left the content layer in Phase 8: the generator derives
   their paths from files that exist by definition, so a per-path check would be vacuous — what can
   go wrong on that channel is a misnamed DIRECTORY, which `verifyRitualDirectories` catches. */
export function collectAssetPaths(content: {
  familyGroups: FamilyGroup[];
}): AssetReference[] {
  const found: AssetReference[] = [];
  content.familyGroups.forEach((group, index) => {
    collectPortraits(group.members, `familyGroups[${index}].members`, found);
  });
  return found;
}

/** Directory names under `assets/rituals/` that match no ritual id. Pure. */
export function unknownRitualDirectories(
  directories: string[],
  ids: string[],
): string[] {
  const known = new Set(ids);
  return directories.filter((directory) => !known.has(directory));
}

/* THE FAILURE THE UPLOAD CHANNEL MAKES. Photographs reach this project by phone — github.com's web
   upload into `assets/rituals/<ritual-id>/` — so a mistyped directory (`wedding_eve`) produces a
   manifest key no ritual reads, and that ritual silently shows nothing with tsc, the suite and the
   build all green. The build fails loudly instead, naming the directory and every id it could have
   meant, because the reader is looking at a deploy log on a phone.

   The reverse is NOT an error: a ritual with no directory is the shipping state, since a ritual
   shows its photographs when it has files and by nothing else. */
export function verifyRitualDirectories(
  directories: string[],
  ids: string[],
): void {
  const unknown = unknownRitualDirectories(directories, ids);
  if (unknown.length === 0) return;
  throw new UnknownRitualDirectoryError(
    `Ritual photograph directories that match no ritual id (${unknown.length}): ${unknown.join(", ")}. Expected one of: ${ids.join(", ")}. Rename the directory under assets/rituals/ to the ritual's id exactly.`,
  );
}

/* The same channel's other mistake: github.com's upload lands in the directory being VIEWED, so a
   photograph uploaded while looking at `assets/rituals/` itself belongs to no ritual. Both scanners
   only read directories, so it would vanish with every gate green. Dotfiles are skipped — the
   `.gitkeep` that holds each ritual's empty folder in place is one. */
export function verifyRitualRootFiles(files: string[], ids: string[]): void {
  const stray = files.filter((file) => !file.startsWith("."));
  if (stray.length === 0) return;
  throw new UnknownRitualDirectoryError(
    `Files directly under assets/rituals/ belong to no ritual (${stray.length}): ${stray.join(", ")}. Move each into the folder of the ritual it belongs to: ${ids.join(", ")}.`,
  );
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
  verifyAssetPaths(collectAssetPaths({ familyGroups }), fileExists);
  /* `assets/`, not `public/`: this checks the SOURCES the couple upload, which is where a typo is
     made. The deliveries under `public/rituals/` are generated from these directories a moment
     later in `prebuild`, so they cannot disagree. */
  const ritualSources = new URL("../assets/rituals", import.meta.url);
  const ritualEntries = existsSync(ritualSources)
    ? readdirSync(ritualSources, { withFileTypes: true })
    : [];
  const ritualIds = rituals.map((ritual) => ritual.id);
  verifyRitualRootFiles(
    ritualEntries
      .filter((entry) => !entry.isDirectory())
      .map((entry) => entry.name),
    ritualIds,
  );
  verifyRitualDirectories(
    ritualEntries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => entry.name),
    ritualIds,
  );
}
