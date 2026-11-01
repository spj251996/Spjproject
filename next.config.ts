import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/* `.dev.tsx` pages (the gallery and `/thread`) build on the dev server and Vercel previews only. Keyed on the phase,
   not NODE_ENV, because `next build` keeps a NODE_ENV that is already set. */
export function pageExtensionsFor(
  phase: string,
  env: { NODE_ENV?: string; VERCEL_ENV?: string },
): string[] {
  if (phase === PHASE_DEVELOPMENT_SERVER || env.VERCEL_ENV === "preview")
    return ["dev.tsx", "tsx", "ts"];
  return ["tsx", "ts"];
}

export default function nextConfig(phase: string): NextConfig {
  return {
    pageExtensions: pageExtensionsFor(phase, process.env),
    output: "export",
    // `output: "export"` has no runtime image optimizer. Without this, images fail at request time
    // while every build gate stays green.
    images: {
      unoptimized: true,
    },
  };
}
