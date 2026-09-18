import type { Metadata } from "next";
import type { ReactNode } from "react";

/* The `.dev.tsx` page extension, gated in next.config.ts, keeps this route out of the export.
   Non-indexable is defence in depth in case it ever leaks into a build. */
export const metadata: Metadata = {
  title: "Design System — SF Wedding",
  robots: { index: false, follow: false },
};

export default function DesignSystemLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="min-h-full">{children}</div>;
}
