import { Fragment } from "react";
import type { FamilyGroup } from "@/content/types";
import { Divider } from "../layout/divider";
import { Portrait } from "../ui/portrait";

/* `FamilyGroup` has no relationship field, so the group heading is mapped from `side`. */

const GROUP_HEADING: Record<FamilyGroup["side"], string> = {
  bride: "Bride's Family",
  groom: "Groom's Family",
};

interface FamilyProps {
  groups: FamilyGroup[];
  className?: string;
}

export function Family({ groups, className }: FamilyProps) {
  return (
    <section
      className={`z-(--z-content) flex flex-col px-space-md py-space-3xl lg:min-h-dvh lg:justify-center ${className ?? ""}`}
    >
      <div className="mx-auto flex w-full max-w-content flex-col lg:flex-row lg:gap-space-3xl">
        {groups.map((group, index) => (
          <Fragment key={group.id}>
            {index === 0 ? null : (
              <Divider className="w-full max-w-text self-center lg:hidden" />
            )}
            <div className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-space-md lg:min-h-0">
              <h2 className="type-heading-lg text-ink">
                {GROUP_HEADING[group.side]}
              </h2>
              <p className="type-body text-ink">{group.familyName}</p>
              <ul className="flex flex-wrap justify-center gap-space-md">
                {group.members.map((member) => (
                  <li key={member.id}>
                    <Portrait
                      name={member.name}
                      relationship={member.relationship}
                      src={member.portrait}
                    />
                  </li>
                ))}
              </ul>
            </div>
          </Fragment>
        ))}
      </div>
    </section>
  );
}
