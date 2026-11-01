import { createHash } from "node:crypto";
import { events, familyGroups, invite, wishes } from "../../content/index.ts";

/* Each measured fit → the `content/` exports its section renders, so a fit whose content has
   changed since it was measured can be detected without a browser. Whole exports rather than the
   fields a section reads: re-measuring a fit that did not need it costs minutes, and a field the
   map forgot would let a stale fit through.

   Not found renders no content export; its copy is literals in `app/not-found.tsx`. */
export const FIT_CONTENT: Readonly<
  Record<string, Readonly<Record<string, unknown>>>
> = {
  invite: { invite, events },
  "event-info": { events },
  family: { familyGroups },
  wishes: { wishes },
  "not-found": {},
};

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, canonical(record[key])]),
    );
  }
  return value;
}

/** SHA-256 of the values' JSON with object keys sorted, so a key reordered in a content module does
    not stale a fit while any changed value does. Hashing the values rather than the files' text
    keeps a comment edit in `content/` from staling one. */
export function contentHash(values: Readonly<Record<string, unknown>>): string {
  return createHash("sha256")
    .update(JSON.stringify(canonical(values)))
    .digest("hex");
}

/** The header line `measure:fit` writes into each fit, and the pattern the test reads it back by. */
export const CONTENT_HASH_PATTERN = /^ {3}Content hash: ([0-9a-f]{64})\b/m;

export function contentHashLine(section: string): string {
  const values = FIT_CONTENT[section];
  if (values === undefined) {
    throw new Error(
      `fit-content: no FIT_CONTENT entry for section "${section}" — add the content exports it renders to scripts/lib/fit-content.ts`,
    );
  }
  return `   Content hash: ${contentHash(values)} (FIT_CONTENT["${section}"], scripts/lib/fit-content.ts).`;
}
