import type { NextConfig } from "next";

/* The `.dev.tsx` page extension keeps the lab routes -- the design-system gallery and the thread lab (`/thread`) --
   out of production. They are pages outside production and on Vercel preview deploys, so the owner can open them on
   a phone from a preview link. `VERCEL_ENV` must be exactly "preview": unset or anything else builds neither, so a
   production build fails closed. */
export function pageExtensionsFor(env: {
  NODE_ENV?: string;
  VERCEL_ENV?: string;
}): string[] {
  if (env.NODE_ENV !== "production" || env.VERCEL_ENV === "preview")
    return ["dev.tsx", "tsx", "ts"];
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
