import type { NextConfig } from "next";

/* Two page extensions keep routes out of production. `.dev.tsx` (the design-system gallery) is a page only
   outside production. `.lab.tsx` (the thread lab, `/thread`) is a page outside production and on Vercel
   preview deploys, so the owner can open it on a phone from a preview link. `VERCEL_ENV` must be exactly
   "preview": unset or anything else builds no lab, so a production build fails closed. */
export function pageExtensionsFor(env: {
  NODE_ENV?: string;
  VERCEL_ENV?: string;
}): string[] {
  if (env.NODE_ENV !== "production") return ["dev.tsx", "lab.tsx", "tsx", "ts"];
  if (env.VERCEL_ENV === "preview") return ["lab.tsx", "tsx", "ts"];
  return ["tsx", "ts"];
}

const nextConfig: NextConfig = {
  pageExtensions: pageExtensionsFor(process.env),
  output: "export",
  // `output: "export"` has no runtime image optimizer. Without this, images fail at request time
  // while every build gate stays green.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
