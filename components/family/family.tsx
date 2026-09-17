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

/* The portrait diameter per type step. `--portrait-rim` restates the rim `portrait` draws outside
   the photo, so the couple line can stop short of it. */
const SHEET_CLASS =
  "flex w-full flex-col items-center text-center [--portrait-diameter:72px] md:[--portrait-diameter:112px] lg:[--portrait-diameter:88px] [--rows-gap:var(--spacing-space-md)] md:[--rows-gap:var(--spacing-space-sm)] [--portrait-rim:calc(var(--stroke-divider)+var(--stroke-rim-offset))]";

const ROWS_CLASS =
  "mt-space-lg flex flex-col items-center gap-(--rows-gap) md:mt-space-sm";

const PORTRAIT_TO_NAME = "gap-space-2xs md:gap-space-3xs";

const PARENTS_GAP =
  "[--couple-gap:var(--spacing-space-lg)] lg:[--couple-gap:var(--spacing-space-xl)]";
const SPOUSES_GAP = "[--couple-gap:var(--spacing-space-md)]";

const SIBLINGS_GAP: Readonly<Record<Side, string>> = {
  bride: "gap-space-2xl md:gap-space-4xl",
  groom: "gap-space-md md:gap-space-2xl",
};

/* How far a name or relationship may run past its portrait on each side before it wraps: measured
   per slot against the gap beside it and the longest label there, so the real roster's text never
   meets. */
const OVERRUN = {
  parent: "[--portrait-overrun:20px] lg:[--portrait-overrun:28px]",
  spouse: "[--portrait-overrun:16px]",
  child: "[--portrait-overrun:48px]",
  sibling: {
    bride: "[--portrait-overrun:32px] md:[--portrait-overrun:64px]",
    groom: "[--portrait-overrun:12px] md:[--portrait-overrun:32px]",
  },
} as const;

/* "Stopping short of both rims" by this much, so the line reads as joining, not touching. */
const COUPLE_LINE_CLEARANCE = "[--couple-line-clearance:2px]";

/* Both lists below restore `role="list"`: WebKit and VoiceOver drop list semantics once
   list-style is none. Each is folded into one constant (clearance included) so the tag stays on
   one line — the ignore comment above `role="list"` only suppresses the line right after it. */
const ROW_LIST_CLASS = "flex list-none flex-wrap items-start justify-center";
const COUPLE_LIST_CLASS = `relative grid w-max auto-cols-fr list-none grid-flow-col justify-items-center gap-(--couple-gap) ${COUPLE_LINE_CLEARANCE}`;

/* The line is its own `li`, `absolute` so it stays out of the grid's item flow — the
   `ul`'s only other children are the two members' `li`s. `aria-hidden` drops it from the
   accessibility tree, so it does not count toward the list's item total. */
const COUPLE_LINE_CLASS =
  "absolute top-[calc(var(--portrait-diameter)/2)] left-[calc(50%-var(--couple-gap)/2+var(--portrait-rim)+var(--couple-line-clearance))] h-(--stroke-divider) w-[calc(var(--couple-gap)-2*var(--portrait-rim)-2*var(--couple-line-clearance))] bg-accent-gold";

export function Family({ group, eyebrow }: FamilyProps) {
  const { parents, children } = splitRoster(group.members);
  const [mother, father] = parents;
  return (
    <div className={SHEET_CLASS}>
      <p className="type-eyebrow">{eyebrow}</p>
      <h2 className="type-heading-script text-ink mt-space-2xs">
        {group.familyName}
      </h2>
      <div className={ROWS_CLASS}>
        <Couple gap={PARENTS_GAP}>
          <MemberPortrait member={mother} overrun={OVERRUN.parent} />
          <MemberPortrait member={father} overrun={OVERRUN.parent} />
        </Couple>
        <Row gap={SIBLINGS_GAP[group.side]}>
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
      <Couple gap={SPOUSES_GAP}>
        <MemberPortrait member={sibling} overrun={OVERRUN.spouse} />
        <MemberPortrait member={spouse} overrun={OVERRUN.spouse} />
      </Couple>
      {children.length === 0 ? null : (
        <Row gap={SIBLINGS_GAP[side]}>
          {children.map((kid) => (
            <MemberPortrait key={kid.id} member={kid} overrun={OVERRUN.child} />
          ))}
        </Row>
      )}
    </div>
  );
}

/* Equal columns keep the gap, and so the line, centred between the two portraits. */
function Couple({ gap, children }: { gap: string; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/noRedundantRoles: WebKit and VoiceOver need it once list-style is none
    <ul className={`${COUPLE_LIST_CLASS} ${gap}`} role="list">
      {Children.map(children, (member) => (
        <li>{member}</li>
      ))}
      <li aria-hidden className={COUPLE_LINE_CLASS} />
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
