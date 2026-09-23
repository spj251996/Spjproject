"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ButtonAction } from "./button-action";
import { ImagePlaceholder } from "./image-placeholder";
import styles from "./timeline-node.module.css";

/* A client component because the glow is a discrete transition fired once on entry, which
   `animation-timeline: view()` cannot express: it is progress-linked, ignores duration and replays on
   re-entry. The observed element is the node's own box, so there is no separate presentational
   panel.

   Flat props rather than `Ritual`: a portable component may not name a domain type. Preview images
   take `alt=""` because the title and the gallery action carry the meaning. */

/* The same URL can appear twice, so keys are the URL plus its occurrence count rather than the
   array index. */
function withKeys(images: string[]) {
  const seen = new Map<string, number>();
  return images.map((src) => {
    const occurrence = seen.get(src) ?? 0;
    seen.set(src, occurrence + 1);
    return { src, key: occurrence === 0 ? src : `${src}#${occurrence}` };
  });
}

type TimelineNodeStatus = "upcoming" | "completed";

interface TimelineNodeProps {
  title: string;
  description: string;
  status: TimelineNodeStatus;
  /** Up to three previews are rendered. */
  previewImages?: string[];
  side?: "left" | "right";
  /** Optional so the node stays renderable from a server page. */
  onOpenGallery?: () => void;
  className?: string;
}

export function TimelineNode({
  title,
  description,
  status,
  previewImages = [],
  side = "left",
  onOpenGallery,
  className,
}: TimelineNodeProps) {
  const nodeRef = useRef<HTMLElement>(null);
  const activatedRef = useRef(false);
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let observer: IntersectionObserver | null = null;

    const activate = () => {
      activatedRef.current = true;
      setActivated(true);
      observer?.disconnect();
      observer = null;
    };

    const sync = () => {
      if (activatedRef.current) {
        return;
      }
      if (motionQuery.matches) {
        activate();
        return;
      }
      const element = nodeRef.current;
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

  const previews = withKeys(previewImages.slice(0, 3));

  return (
    <article
      className={`flex flex-col gap-space-sm ${side === "right" ? "lg:items-start lg:text-left" : "lg:items-end lg:text-right"} ${className ?? ""}`}
      ref={nodeRef}
    >
      <span
        aria-hidden="true"
        className={`${styles.mark} block size-space-2xs rounded-full`}
        data-activated={activated}
      />
      <h3 className="type-heading-lg text-ink">{title}</h3>
      <p className="type-body max-w-text text-ink">{description}</p>

      {status === "completed" ? (
        <>
          {previews.length === 0 ? null : (
            <ul className="flex w-full gap-space-2xs">
              {previews.map(({ src, key }) => (
                <li className="min-w-0 flex-1" key={key}>
                  <div className="relative overflow-hidden rounded-card">
                    <ImagePlaceholder height={5} width={4} />
                    <Image
                      alt=""
                      className="object-cover"
                      fill
                      sizes="(min-width: 64rem) 15vw, 30vw"
                      src={src}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {onOpenGallery === undefined ? null : (
            <ButtonAction onClick={onOpenGallery}>View photos</ButtonAction>
          )}
        </>
      ) : null}
    </article>
  );
}
