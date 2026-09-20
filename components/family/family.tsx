import { Children, type ReactNode } from "react";
import type { FamilyGroup, FamilyMember } from "@/content/types";
import { Portrait } from "../ui/portrait";
import { splitCluster, splitRoster } from "./family-cluster";

/* One group's sheet. `measure:fit` finds each sheet by the `h2` that is a direct child of this root. */

interface FamilyProps {
  group: FamilyGroup;
  eyebrow: string;
}

type Side = FamilyGroup["side"];

/* The portrait diameter per type step. */
const SHEET_CLASS =
  "flex w-full flex-col items-center text-center [--portrait-diameter:72px] md:[--portrait-diameter:112px] lg:[--portrait-diameter:72px] xl:[--portrait-diameter:88px] [--rows-gap:var(--spacing-space-md)] md:[--rows-gap:var(--spacing-space-sm)] lg:[--rows-gap:var(--spacing-space-xs)] xl:[--rows-gap:var(--spacing-space-sm)] [--family-row-gap:var(--spacing-space-lg)] md:[--family-row-gap:var(--spacing-space-2xl)] lg:[--family-row-gap:var(--spacing-space-xl)] xl:[--family-row-gap:var(--spacing-space-2xl)]";

const ROWS_CLASS =
  "mt-space-lg flex flex-col items-center gap-(--rows-gap) md:mt-space-sm lg:mt-space-xs xl:mt-space-sm";

const PORTRAIT_TO_NAME = "gap-space-2xs md:gap-space-3xs";

/* One gap for every row of the tree, so the rows read as a stack rather than as three
   separately-tuned arrangements. `--family-row-gap` is declared on the sheet, so a couple's
   grid gap and a row's flex gap resolve to the same length at every tier. */
const EQUAL_GAP = "[--couple-gap:var(--family-row-gap)]";
const EQUAL_ROW_GAP = "gap-(--family-row-gap)";

/* The nephews are the exception: they sit under their parents rather than across the sheet, and
   share the width of one sibling slot, so they keep their own per-side spacing. */
const NEPHEWS_GAP: Readonly<Record<Side, string>> = {
  bride: "gap-space-2xl md:gap-space-4xl lg:gap-space-3xl xl:gap-space-4xl",
  groom: "gap-space-md md:gap-space-2xl lg:gap-space-xl xl:gap-space-2xl",
};

/* How far a name or relationship may run past its portrait on each side before it wraps: measured
   per slot against the gap beside it and the longest label there, so the real roster's text never
   meets. */
const OVERRUN = {
  parent: "[--portrait-overrun:20px] xl:[--portrait-overrun:28px]",
  spouse: "[--portrait-overrun:16px]",
  child: "[--portrait-overrun:48px]",
  sibling: {
    bride: "[--portrait-overrun:32px] md:[--portrait-overrun:64px]",
    groom: "[--portrait-overrun:12px] md:[--portrait-overrun:32px]",
  },
} as const;

/* Both lists below restore `role="list"`: WebKit and VoiceOver drop list semantics once
   list-style is none. Each is folded into one constant (clearance included) so the tag stays on
   one line — the ignore comment above `role="list"` only suppresses the line right after it. */
const ROW_LIST_CLASS = "flex list-none flex-wrap items-start justify-center";
const COUPLE_LIST_CLASS =
  "grid w-max auto-cols-fr list-none grid-flow-col justify-items-center gap-(--couple-gap)";

export function Family({ group, eyebrow }: FamilyProps) {
  const { parents, children } = splitRoster(group.members);
  const [mother, father] = parents;
  return (
    <div className={SHEET_CLASS}>
      <p className="type-eyebrow">{eyebrow}</p>
      <h2 className="type-heading-xl text-ink-muted mt-space-2xs">
        {group.familyName}
      </h2>
      <div className={ROWS_CLASS}>
        <Couple gap={EQUAL_GAP}>
          <MemberPortrait member={mother} overrun={OVERRUN.parent} />
          <MemberPortrait member={father} overrun={OVERRUN.parent} />
        </Couple>
        <Row gap={EQUAL_ROW_GAP}>
          {children.map((child) => (
            <ChildSlot child={child} key={child.id} side={group.side} />
          ))}
        </Row>
      </div>
    </div>
  );
}

function MemberPortrait({
  member,
  overrun,
}: {
  member: FamilyMember;
  overrun: string;
}) {
  return (
    <Portrait
      className={`${PORTRAIT_TO_NAME} ${overrun}`}
      name={member.name}
      relationship={member.relationship}
      src={member.portrait}
    />
  );
}

function ChildSlot({ child, side }: { child: FamilyMember; side: Side }) {
  const { row, children } = splitCluster(child);
  const [sibling, spouse] = row;
  if (spouse === undefined) {
    return <MemberPortrait member={sibling} overrun={OVERRUN.sibling[side]} />;
  }
  return (
    <div className="flex flex-col items-center gap-(--rows-gap)">
      <Couple gap={EQUAL_GAP}>
        <MemberPortrait member={sibling} overrun={OVERRUN.spouse} />
        <MemberPortrait member={spouse} overrun={OVERRUN.spouse} />
      </Couple>
      {children.length === 0 ? null : (
        <Row gap={NEPHEWS_GAP[side]}>
          {children.map((kid) => (
            <MemberPortrait key={kid.id} member={kid} overrun={OVERRUN.child} />
          ))}
        </Row>
      )}
    </div>
  );
}

/* Equal columns keep the pair centred on the gap between them. */
function Couple({ gap, children }: { gap: string; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/noRedundantRoles: WebKit and VoiceOver need it once list-style is none
    <ul className={`${COUPLE_LIST_CLASS} ${gap}`} role="list">
      {Children.map(children, (member) => (
        <li>{member}</li>
      ))}
    </ul>
  );
}

function Row({ gap, children }: { gap: string; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/noRedundantRoles: WebKit and VoiceOver need it once list-style is none
    <ul className={`${ROW_LIST_CLASS} ${gap}`} role="list">
      {Children.map(children, (member) => (
        <li>{member}</li>
      ))}
    </ul>
  );
}
