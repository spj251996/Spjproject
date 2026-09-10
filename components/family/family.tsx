"use client";

import { Fragment, useEffect, useId, useRef, useState } from "react";
import type { FamilyGroup } from "@/content/types";
import { Divider } from "../layout/divider";
import { Portrait } from "../ui/portrait";
import styles from "./family.module.css";

/* DESIGN.md → Domain Components → Family [standalone].

   Client boundary, and what forces it: the wrap-extend-join is the page's one key interaction, and
   Foundations → Motion assigns it {motion.duration.slow} — a DURATION token, which that section
   reserves for discrete transitions and withholds from scroll-linked motion. A discrete transition
   fired once when the section enters view is not expressible declaratively: `animation-timeline:
   view()` is progress-linked, ignores duration, and replays on re-entry. So script is forced, and
   this component owns its reduced-motion gate (honored at the source — no observer is attached when
   the preference is set) and its first client frame (per-case defaults in family.module.css).

   Not split into a presentational panel: the observed element is the section's own layout box, so a
   pure panel could not be the thing observed without an extra wrapper that changes that box. No demo
   affordance is needed either — the section is ordinary in-flow content, so a bounded frame renders
   it and the observer fires normally.

   PROVISIONAL GEOMETRY. DESIGN.md states that thread paths are predefined per layout system but
   supplies no path data. The two curves below carry the documented SHAPE only — enter, loop around
   the first group, extend to the second, end joined — and are not transcribed from the doc. Each
   doubles back on itself, which is what "wraps" means and what forces the mask form the stylesheet
   describes. They are placed here so the gesture renders, and are expected to be replaced once
   layouts are settled.

   Both are routed through the band the composition leaves empty — below the portraits on desktop,
   down the outer margin and through the gap between the two segments on mobile. A first pass drew
   them across the groups row and the thread struck through the names; Cross-Cutting Rules keep
   decorative layers off the content, and a 1.8px line over a name is unreadable either way. The
   viewBox is the SECTION, not the groups row, so those empty bands exist to route through.

   This segment is section-anchored on purpose. `thread-overlay` is `position: fixed`, so its path is
   viewport-relative and cannot anchor to page content at all — while the doc requires the thread to
   anchor "to the two family sides". The overlay carries the continuous page-spanning line; this
   segment carries the gesture that has to know where the two groups are. {colors.thread-red} is
   permitted here because this IS the thread system, on the same grounds as `timeline-node`'s anchor
   mark.

   The group heading is derived: the doc heads each group with "the relationship", and `FamilyGroup`
   carries only `side` and `familyName` — no relationship field. The map below is inferred. Member
   order is the content's own order: the doc prescribes parents, then the couple member with
   siblings, and the schema has no role field that could express it. */

const GROUP_HEADING: Record<FamilyGroup["side"], string> = {
  bride: "Bride's Family",
  groom: "Groom's Family",
};

const MOBILE_PATH =
  "M 3 4 C 3 20 4 32 10 44 C 18 56 30 52 27 45 C 24 38 12 41 8 52 C 5 62 4 76 5 88 C 6 94 10 97 16 97";

const DESKTOP_PATH =
  "M 2 78 C 8 92 24 96 30 86 C 35 78 24 72 18 80 C 12 88 20 96 34 96 C 52 96 62 88 74 84 C 84 81 92 84 98 90";

interface FamilyProps {
  groups: FamilyGroup[];
  className?: string;
}

export function Family({ groups, className }: FamilyProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const activatedRef = useRef(false);
  const [activated, setActivated] = useState(false);
  const instanceId = useId();
  const mobileMaskId = `family-thread-mobile-${instanceId}`;
  const desktopMaskId = `family-thread-desktop-${instanceId}`;

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let observer: IntersectionObserver | null = null;

    const activate = () => {
      activatedRef.current = true;
      setActivated(true);
      observer?.disconnect();
      observer = null;
    };

    /* Re-evaluated on preference change, not once at mount. */
    const sync = () => {
      if (activatedRef.current) {
        return;
      }
      if (motionQuery.matches) {
        /* Reduced motion: the thread is already fully drawn by the stylesheet's base state, and no
           observer is attached. Flipping the flag keeps the rest state and the markup in step. */
        activate();
        return;
      }
      const element = sectionRef.current;
      if (element === null || observer !== null) {
        return;
      }
      observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          activate();
        }
      });
      observer.observe(element);
    };

    sync();
    motionQuery.addEventListener("change", sync);
    return () => {
      motionQuery.removeEventListener("change", sync);
      observer?.disconnect();
    };
  }, []);

  return (
    <section
      className={`relative z-(--z-content) flex flex-col px-space-md py-space-3xl lg:min-h-dvh lg:justify-center ${className ?? ""}`}
      ref={sectionRef}
    >
      <div className="mx-auto flex w-full max-w-content flex-col lg:flex-row lg:gap-space-3xl">
        {groups.map((group, index) => (
          <Fragment key={group.id}>
            {/* Foundations → Layout → `divider`: between family groupings. On desktop the
                two-column split separates them spatially instead. */}
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

      <svg
        aria-hidden="true"
        className={styles.thread}
        data-activated={activated}
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        <mask
          height="120"
          id={mobileMaskId}
          maskUnits="userSpaceOnUse"
          width="120"
          x="-10"
          y="-10"
        >
          <path className={styles.reveal} d={MOBILE_PATH} pathLength="1" />
        </mask>
        <mask
          height="120"
          id={desktopMaskId}
          maskUnits="userSpaceOnUse"
          width="120"
          x="-10"
          y="-10"
        >
          <path className={styles.reveal} d={DESKTOP_PATH} pathLength="1" />
        </mask>
        <path
          className={`${styles.path} stroke-(length:--stroke-thread) lg:hidden`}
          d={MOBILE_PATH}
          mask={`url(#${mobileMaskId})`}
          vectorEffect="non-scaling-stroke"
        />
        <path
          className={`${styles.path} hidden stroke-(length:--stroke-thread) lg:inline`}
          d={DESKTOP_PATH}
          mask={`url(#${desktopMaskId})`}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </section>
  );
}
