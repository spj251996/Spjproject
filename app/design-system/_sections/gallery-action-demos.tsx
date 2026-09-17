"use client";

import type { ComponentProps } from "react";
import { ButtonAction } from "@/components/ui/button-action";
import { TimelineNode } from "@/components/ui/timeline-node";

/* A function prop cannot cross from the server page, so the gallery forms are posed from this
   client leaf. The handler does nothing: the gallery does not open a modal. */
function noop() {}

export function GalleryButtonActionDemo() {
  return <ButtonAction onClick={noop}>View photos</ButtonAction>;
}

type TimelineNodeDemoProps = Omit<
  ComponentProps<typeof TimelineNode>,
  "onOpenGallery"
>;

export function TimelineNodeDemo(props: TimelineNodeDemoProps) {
  return (
    <TimelineNode
      {...props}
      onOpenGallery={props.status === "completed" ? noop : undefined}
    />
  );
}
