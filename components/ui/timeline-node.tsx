"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ButtonAction } from "./button-action";
import { ImagePlaceholder } from "./image-placeholder";
import styles from "./timeline-node.module.css";

/* DESIGN.md → Components → UI → `timeline-node`.

   Client boundary, and what forces it: the entry says the node "activates with a thread glow when it
   enters the viewport, once, without repeating", and Foundations → Motion assigns that glow
   {motion.duration.fast} — a duration token, which the same section reserves for discrete
   transitions and withholds from scroll-linked motion. A discrete transition fired once on entry is
   not expressible declaratively: `animation-timeline: view()` is progress-linked (it ignores
   duration and replays on re-entry), which is the mechanism the doc's own taxonomy rules out. So
   script is forced, and this component owns its reduced-motion gate and its first client frame.

   Not split into a presentational panel: the observed element is the node's own layout box, so a
   pure panel could not be the thing observed without an extra wrapper that changes that box.

   Props are flat scalars — the portable layer may not name `Ritual`. `onOpenGallery` is optional so
   the component stays renderable from a server page; a caller supplying it is already a client
   component. Preview images are decorative here (`alt=""`): the title and the gallery action carry
   the meaning, and the doc supplies no per-image description. */

/* An image list is a plain `string[]`, so the same URL can legitimately appear twice and a
   src-keyed list collapses. Keys are the URL plus its occurrence ordinal — derived from the data
   rather than from the array index, which identifies a position instead of a thing. */
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
  /** Up to three previews are rendered; the doc specifies a 2–3 image preview. */
  previewImages?: string[];
  side?: "left" | "right";
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

    /* Re-evaluated on preference change, not once at mount. */
    const sync = () => {
      if (activatedRef.current) {
        return;
      }
      if (motionQuery.matches) {
        /* Reduced motion: the resting state is complete and static, and no observer is attached. */
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
                  <div className="relative overflow-hidden rounded-sm">
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
