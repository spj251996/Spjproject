import { Children, type ReactNode } from "react";
import { SprigOrnament } from "@/components/ui/sprig-ornament";
import type { FamilyGroup, FamilyMember } from "@/content/types";
import { Portrait } from "../ui/portrait";
import { flattenCluster, splitChildren, splitRoster } from "./family-cluster";

/* One group's sheet. `measure:fit` finds each sheet by the `h2` that is a direct child of this root. */

interface FamilyProps {
  group: FamilyGroup;
  eyebrow: string;
}

type Side = FamilyGroup["side"];

/* Portrait diameter and row gaps per type step; values in DESIGN.md Components, portrait. */
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

/* How far a name or relationship may run past its portrait before it wraps; one value per side for
   the child rows, since every child-row member sits in the same kind of slot. If these are
   revisited, measure the rendered row rather than comparing boxes: `TextLine` is deliberately wider
   than its portrait (that is what `--portrait-overrun` buys), so adjacent spans overlap by design and
   a box comparison reports collisions that are not there. */
const OVERRUN = {
  parent: "[--portrait-overrun:20px] xl:[--portrait-overrun:28px]",
  row: {
    bride: "[--portrait-overrun:32px] md:[--portrait-overrun:64px]",
    groom: "[--portrait-overrun:12px] md:[--portrait-overrun:32px]",
  },
} as const satisfies { parent: string; row: Record<Side, string> };

/* Both lists below restore `role="list"`: WebKit and VoiceOver drop list semantics once
   list-style is none. Each is folded into one constant (clearance included) so the tag stays on
   one line — the ignore comment above `role="list"` only suppresses the line right after it. */
const ROW_LIST_CLASS = "flex list-none flex-wrap items-start justify-center";
const COUPLE_LIST_CLASS =
  "grid w-max auto-cols-fr list-none grid-flow-col justify-items-center gap-(--couple-gap)";

export function Family({ group, eyebrow }: FamilyProps) {
  const { parents, children } = splitRoster(group.members);
  const [mother, father] = parents;
  const { clusters, plain } = splitChildren(children);
  return (
    <div className={SHEET_CLASS}>
      <p className="type-eyebrow">
        <SprigOrnament>{eyebrow}</SprigOrnament>
      </p>
      <h2 className="type-heading-xl text-ink-muted mt-space-2xs">
        {group.familyName}
      </h2>
      <div className={ROWS_CLASS}>
        <Couple gap={EQUAL_GAP}>
          <MemberPortrait member={mother} overrun={OVERRUN.parent} />
          <MemberPortrait member={father} overrun={OVERRUN.parent} />
        </Couple>
        {clusters.map((cluster) => (
          <Row gap={EQUAL_ROW_GAP} key={cluster.id}>
            {flattenCluster(cluster).map((member) => (
              <MemberPortrait
                key={member.id}
                member={member}
                overrun={OVERRUN.row[group.side]}
              />
            ))}
          </Row>
        ))}
        {/* No row at all when there are none: an empty `Row` is a gap with no portraits in it. */}
        {plain.length > 0 && (
          <Row gap={EQUAL_ROW_GAP}>
            {plain.map((member) => (
              <MemberPortrait
                key={member.id}
                member={member}
                overrun={OVERRUN.row[group.side]}
              />
            ))}
          </Row>
        )}
      </div>
    </div>
  );
}

/* The couple's own portraits glow (owner, 2026-10-11 — DESIGN.md -> Components -> `portrait`).
   Keyed on the relationship the reader sees, so it follows them wherever they are listed. */
const COUPLE: ReadonlySet<string> = new Set(["Bride", "Groom"]);

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
      glow={COUPLE.has(member.relationship)}
      name={member.name}
      relationship={member.relationship}
      src={member.portrait}
    />
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
