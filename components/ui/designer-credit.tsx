import type { ReactElement } from "react";
import { SprigIcon } from "@/components/icons";
import { credit } from "@/content";
import { FLOOR_DIAGONAL } from "./sprig-ornament";

/* The site's credit to its designer — DESIGN.md → Components → UI → `designer-credit`. It places
   nothing: each call site decides where it sits, so the component never moves a measured fit. */

/* The hit area grows to `--touch-target` through a pseudo-element, so neither the line box nor the box the
   focus ring draws round grows: padding the link put the ring's bottom edge past `main`'s clip at the page's foot. */
const LINK =
  "[--credit-hit:calc((var(--touch-target)-1lh)/2)] relative inline-block before:absolute before:inset-x-0 before:-inset-y-(--credit-hit) underline decoration-1 underline-offset-4 [text-decoration-color:color-mix(in_srgb,currentColor_35%,transparent)]";

export function DesignerCredit({
  layout,
}: {
  layout: "line" | "signoff";
}): ReactElement {
  if (layout === "line") {
    /* Bold below md: on a phone the botanical's ink sits behind the name. */
    return (
      <p className="type-caption text-ink-muted text-center">
        <span className="type-caption-italic">{credit.lead}</span>{" "}
        <span aria-hidden="true">·</span>{" "}
        <a className={`${LINK} font-bold md:font-normal`} href={credit.url}>
          {credit.name}
        </a>
      </p>
    );
  }
  return (
    <div className="flex flex-col items-center text-center text-ink-muted">
      <SprigIcon className="text-accent-gold" size={FLOOR_DIAGONAL} />
      <p className="type-caption-italic mt-space-2xs">{credit.lead}</p>
      <p className="type-caption mt-space-3xs">
        <a className={LINK} href={credit.url}>
          {credit.name}
        </a>
      </p>
    </div>
  );
}
