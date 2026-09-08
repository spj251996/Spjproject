import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // `output: "export"` has no image optimizer at runtime, so `next/image` must be told to skip
  // it. This changes what the output does rather than whether it compiles: without it the
  // gallery's images fail at request time while every gate stays green.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
