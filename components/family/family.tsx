import type { FamilyGroup, FamilyMember } from "@/content/types";
import { Portrait } from "../ui/portrait";
import { splitCluster } from "./family-cluster";

/* One group's sheet. `measure:fit` finds each sheet by the `h2` that is a direct child of this root. */

interface FamilyProps {
  group: FamilyGroup;
  eyebrow: string;
}

export function Family({ group, eyebrow }: FamilyProps) {
  return (
    <div className="flex w-full flex-col items-center text-center">
      <p className="type-eyebrow">{eyebrow}</p>
      <h2 className="type-heading-script text-ink mt-space-2xs">
        {group.familyName}
      </h2>
      <MemberList members={group.members} />
    </div>
  );
}

const MEMBER_LIST_CLASS =
  "mt-space-lg flex list-none flex-wrap justify-center gap-space-md";

function MemberList({ members }: { members: FamilyMember[] }) {
  return (
    // biome-ignore lint/a11y/noRedundantRoles: WebKit and VoiceOver need it once list-style is none
    <ul className={MEMBER_LIST_CLASS} role="list">
      {members.map((member) => (
        <li key={member.id}>
          <MemberSlot member={member} />
        </li>
      ))}
    </ul>
  );
}

function MemberPortrait({ member }: { member: FamilyMember }) {
  return (
    <Portrait
      name={member.name}
      relationship={member.relationship}
      src={member.portrait}
    />
  );
}

function MemberSlot({ member }: { member: FamilyMember }) {
  const { row, children } = splitCluster(member);
  if (row.length === 1 && children.length === 0) {
    return <MemberPortrait member={member} />;
  }
  return (
    <div className="flex flex-col items-center gap-space-md">
      <div className="flex justify-center gap-space-md">
        {row.map((person) => (
          <MemberPortrait key={person.id} member={person} />
        ))}
      </div>
      {children.length === 0 ? null : (
        <div className="flex justify-center gap-space-md">
          {children.map((person) => (
            <MemberPortrait key={person.id} member={person} />
          ))}
        </div>
      )}
    </div>
  );
}
