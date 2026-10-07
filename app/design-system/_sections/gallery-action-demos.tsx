"use client";

import { ButtonAction } from "@/components/ui/button-action";

/* A function prop cannot cross from the server page, so the gallery's bare `onClick` form is
   posed from this client leaf. The handler does nothing: this specimen opens no modal.

   `photo-row` needs no wrapper of its own — `photo-strip` is already a client component and owns
   its state, so the server page renders it directly. */
function noop() {}

export function GalleryButtonActionDemo() {
  return <ButtonAction onClick={noop}>View photos</ButtonAction>;
}
