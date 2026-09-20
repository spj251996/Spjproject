import { parseIsoDate } from "./format.ts";
import type {
  EventSegment,
  FamilyGroup,
  FamilyMember,
  InviteContent,
  Ritual,
  WeddingEvent,
  WishesContent,
} from "./types.ts";

/* Semantic validation only. Shape is TypeScript's job and is enforced at compile time; this file
   carries what types cannot express — uniqueness, non-emptiness, real calendar dates, and the
   absolute/root-relative distinction for URLs and asset paths.

   Every check names its path (`familyGroups[1].members[2].family[0].name`) because the reader is a
   content editor looking at a build log, not the author of this file. */

export class ContentValidationError extends Error {
  constructor(path: string, problem: string) {
    super(`Content validation failed: ${path} ${problem}`);
    this.name = "ContentValidationError";
  }
}

function required(value: string, path: string): void {
  if (value.trim() === "")
    throw new ContentValidationError(path, "must not be empty");
}

function optionalText(value: string | null, path: string): void {
  if (value !== null && value.trim() === "")
    throw new ContentValidationError(
      path,
      "must be null when absent, never an empty string",
    );
}

function absoluteUrl(value: string | null, path: string): void {
  optionalText(value, path);
  if (value === null) return;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ContentValidationError(
      path,
      `is not an absolute URL ("${value}")`,
    );
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new ContentValidationError(
      path,
      `must be an http(s) URL ("${value}")`,
    );
  }
}

function assetPath(value: string | null, path: string): void {
  optionalText(value, path);
  if (value === null) return;
  if (!value.startsWith("/")) {
    throw new ContentValidationError(
      path,
      `must be root-relative, starting with "/" ("${value}")`,
    );
  }
}

function isoDate(value: string, path: string): void {
  if (parseIsoDate(value) === null) {
    throw new ContentValidationError(
      path,
      `must be a real calendar date in ISO 8601 form, YYYY-MM-DD ("${value}")`,
    );
  }
}

/* Shared id registry so a nested member cannot reuse a top-level member's id. Scope is whatever
   registry the caller passes, deliberately: ritual, event and family-group ids are unique across
   their whole collection, segment ids only within their event, and member ids only within their
   family group — so a bride-side and a groom-side member may both be "m". */
function claimId(id: string, path: string, seen: Set<string>): void {
  required(id, path);
  if (seen.has(id))
    throw new ContentValidationError(
      path,
      `duplicates an earlier id ("${id}")`,
    );
  seen.add(id);
}

export function validateRituals(rituals: Ritual[]): Ritual[] {
  const seen = new Set<string>();
  rituals.forEach((ritual, index) => {
    const at = `rituals[${index}]`;
    claimId(ritual.id, `${at}.id`, seen);
    required(ritual.title, `${at}.title`);
    required(ritual.description, `${at}.description`);
    ritual.images.forEach((image, i) => {
      required(image, `${at}.images[${i}]`);
      assetPath(image, `${at}.images[${i}]`);
    });
  });
  return rituals;
}

function validateSegment(segment: EventSegment, at: string): void {
  required(segment.label, `${at}.label`);
  optionalText(segment.time, `${at}.time`);
  optionalText(segment.venue, `${at}.venue`);
  optionalText(segment.address, `${at}.address`);
  absoluteUrl(segment.mapUrl, `${at}.mapUrl`);
}

export function validateEvents(events: WeddingEvent[]): WeddingEvent[] {
  const seen = new Set<string>();
  events.forEach((event, index) => {
    const at = `events[${index}]`;
    claimId(event.id, `${at}.id`, seen);
    required(event.cityTown, `${at}.cityTown`);
    required(event.state, `${at}.state`);
    isoDate(event.date, `${at}.date`);
    if (event.segments.length === 0) {
      throw new ContentValidationError(
        `${at}.segments`,
        "must list at least one segment",
      );
    }
    const segmentIds = new Set<string>();
    event.segments.forEach((segment, i) => {
      claimId(segment.id, `${at}.segments[${i}].id`, segmentIds);
      validateSegment(segment, `${at}.segments[${i}]`);
    });
  });
  return events;
}

function validateMember(
  member: FamilyMember,
  at: string,
  seen: Set<string>,
): void {
  claimId(member.id, `${at}.id`, seen);
  required(member.name, `${at}.name`);
  required(member.relationship, `${at}.relationship`);
  assetPath(member.portrait, `${at}.portrait`);
  member.family.forEach((relative, i) => {
    validateMember(relative, `${at}.family[${i}]`, seen);
  });
}

export function validateFamilyGroups(groups: FamilyGroup[]): FamilyGroup[] {
  const groupIds = new Set<string>();
  const sides = groups.map((g) => g.side);
  if (
    sides.length !== 2 ||
    !sides.includes("bride") ||
    !sides.includes("groom")
  ) {
    throw new ContentValidationError(
      "familyGroups",
      `must hold exactly one "bride" group and one "groom" group (got: ${sides.join(", ") || "none"})`,
    );
  }
  groups.forEach((group, index) => {
    const at = `familyGroups[${index}]`;
    claimId(group.id, `${at}.id`, groupIds);
    required(group.familyName, `${at}.familyName`);
    if (group.members.length === 0) {
      throw new ContentValidationError(
        `${at}.members`,
        "must list at least one member",
      );
    }
    const memberIds = new Set<string>();
    group.members.forEach((m, i) => {
      validateMember(m, `${at}.members[${i}]`, memberIds);
    });
  });
  return groups;
}

export function validateInvite(invite: InviteContent): InviteContent {
  required(invite.eyebrow, "invite.eyebrow");
  required(invite.coupleNames, "invite.coupleNames");
  required(invite.passage, "invite.passage");
  required(invite.passageAttribution, "invite.passageAttribution");
  return invite;
}

export function validateWishes(wishes: WishesContent): WishesContent {
  required(wishes.passage, "wishes.passage");
  required(wishes.passageAttribution, "wishes.passageAttribution");
  required(wishes.coupleNames, "wishes.coupleNames");
  required(wishes.wishesLead, "wishes.wishesLead");
  required(wishes.wishesLine, "wishes.wishesLine");
  return wishes;
}
