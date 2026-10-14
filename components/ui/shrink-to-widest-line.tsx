"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { widestLine } from "@/components/ui/widest-line";

/* A paragraph that, once it wraps, narrows its own box to its widest line — so a centred `w-fit`
   group around it centres on the ink rather than on the width the text was offered. CSS has no
   shrink-to-wrapped-width; this measures it. DESIGN.md → Domain Components → Event Info.

   +1px of headroom so a sub-pixel rounding can never re-wrap a line: a changed line count would
   change the section's height and leave its measured fit stale. Re-fits only when the window's
   WIDTH changes — a phone's URL bar resizes the height during every scroll, and the text cannot
   rewrap on that. */
export function ShrinkToWidestLine({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (element === null) return;
    let cancelled = false;
    let width = -1;
    const fit = () => {
      element.style.removeProperty("max-width");
      const range = document.createRange();
      range.selectNodeContents(element);
      const line = widestLine([...range.getClientRects()]);
      if (line.lines > 1) {
        element.style.maxWidth = `${Math.ceil(line.width) + 1}px`;
      }
    };
    const onResize = () => {
      const next = document.documentElement.clientWidth;
      if (next === width) return;
      width = next;
      fit();
    };
    document.fonts.ready.then(() => {
      if (cancelled) return;
      onResize();
      window.addEventListener("resize", onResize);
    });
    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <p className={className} data-shrink-to-line ref={ref}>
      {children}
    </p>
  );
}
