import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev-only routes use a `.dev.tsx` page extension, which is only treated as a
  // page outside production — so the design-system gallery is never emitted.
  pageExtensions:
    process.env.NODE_ENV === "production"
      ? ["tsx", "ts"]
      : ["dev.tsx", "tsx", "ts"],
  output: "export",
  // `output: "export"` has no runtime image optimizer. Without this, images fail at request time
  // while every build gate stays green.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
