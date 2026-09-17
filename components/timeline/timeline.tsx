"use client";

import { useId, useState } from "react";
import type { Ritual } from "@/content/types";
import { GalleryModal } from "../ui/gallery-modal";
import { TimelineNode } from "../ui/timeline-node";
import styles from "./timeline.module.css";

/* A client component because the open gallery is state shared by the node list and the modal. The
   spine's motion is declarative CSS, so it needs no reduced-motion gate here.

   On desktop the anchor marks flank the spine across the gutter rather than sitting on it:
   `timeline-node` exposes no API to position them exactly.

   The spine is section-anchored because the fixed `thread-overlay` cannot anchor to page content.

   A completed ritual with no images gets no gallery action, since it would open nothing. */

const SPINE_PATH = "M 2 0 L 2 100";

interface TimelineProps {
  /** Section heading text; the caller supplies the copy. */
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
