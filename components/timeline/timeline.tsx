"use client";

import { useId, useState } from "react";
import type { Ritual } from "@/content/types";
import { GalleryModal } from "../ui/gallery-modal";
import { TimelineNode } from "../ui/timeline-node";
import styles from "./timeline.module.css";

/* DESIGN.md → Domain Components → Timeline [standalone].

   Client boundary, and what forces it: which ritual's gallery is open. `timeline-node` takes
   `onOpenGallery` and `gallery-modal` takes `onClose`, so the open state is shared between the node
   list and the modal and cannot be pushed below the list. What remains inside the boundary beyond
   that is a heading and a static SVG spine — the spine's own motion is declarative CSS and runs
   whether or not this file is a client component, so extracting them would add a file DESIGN.md does
   not name for no runtime benefit.

   The spine attaches no scripted motion, so this component has no reduced-motion gate of its own to
   discharge: the spine's gate is structural in timeline.module.css, and each node owns its own.

   The deliberate exception to one-viewport composition — no `min-h-dvh` here. The section takes
   however many rituals exist and scrolls to its natural length; nothing assumes a node count.

   Alternation is layout, not a node concern: each node occupies the full width on mobile and half
   the track on desktop, alternating sides, and `side` tells the node which way to align its own
   content. `timeline-node` renders its anchor mark at the inner edge of that half. On mobile that
   lands the mark on the spine; on desktop the two halves sit either side of the centre line, so the
   marks flank the spine across the gutter rather than sitting on it — placing them exactly would
   need a positioning API `timeline-node` does not expose. Reported as a gap.

   This segment is section-anchored for the same reason the family gesture is: `thread-overlay` is
   `position: fixed`, so its path is viewport-relative and cannot anchor to page content, while the
   doc requires the thread to anchor to each ritual node. {colors.thread-red} is permitted here
   because this IS the thread system, on the same grounds as `timeline-node`'s anchor mark.

   A completed ritual with no images gets no gallery action — an empty overlay is not a state the doc
   describes, and the button would open nothing. */

const SPINE_PATH = "M 2 0 L 2 100";

interface TimelineProps {
  /** Section heading text. DESIGN.md gives the section no title copy, so the caller supplies it. */
  title: string;
  rituals: Ritual[];
  className?: string;
}

export function Timeline({ title, rituals, className }: TimelineProps) {
  const [openRitualId, setOpenRitualId] = useState<string | null>(null);
  const maskId = `timeline-spine-${useId()}`;
  const openRitual = rituals.find((ritual) => ritual.id === openRitualId);

  return (
    <section
      className={`relative z-(--z-content) flex flex-col gap-space-2xl px-space-md py-space-3xl ${className ?? ""}`}
    >
      <h2 className="type-heading-xl mx-auto w-full max-w-content text-ink">
        {title}
      </h2>

      <div className="relative mx-auto w-full max-w-content">
        <svg
          aria-hidden="true"
          className={`${styles.spine} left-space-lg lg:left-1/2`}
          preserveAspectRatio="none"
          viewBox="0 0 4 100"
        >
          <mask
            height="104"
            id={maskId}
            maskUnits="userSpaceOnUse"
            width="8"
            x="-2"
            y="-2"
          >
            <rect
              className={styles.reveal}
              height="100"
              width="8"
              x="-2"
              y="0"
            />
          </mask>
          <path
            className={`${styles.line} stroke-(length:--stroke-thread)`}
            d={SPINE_PATH}
            mask={`url(#${maskId})`}
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <ol className="flex flex-col gap-space-2xl pl-space-lg lg:pl-0">
          {rituals.map((ritual, index) => {
            const side = index % 2 === 0 ? "left" : "right";
            const hasGallery =
              ritual.status === "completed" && ritual.images.length > 0;

            return (
              <li className="flex" key={ritual.id}>
                <div
                  className={
                    side === "left"
                      ? "w-full lg:w-1/2 lg:pr-space-md"
                      : "w-full lg:ml-auto lg:w-1/2 lg:pl-space-md"
                  }
                >
                  <TimelineNode
                    description={ritual.description}
                    onOpenGallery={
                      hasGallery ? () => setOpenRitualId(ritual.id) : undefined
                    }
                    previewImages={ritual.images}
                    side={side}
                    status={ritual.status}
                    title={ritual.title}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {openRitual === undefined ? null : (
        <GalleryModal
          images={openRitual.images}
          onClose={() => setOpenRitualId(null)}
          title={openRitual.title}
        />
      )}
    </section>
  );
}
