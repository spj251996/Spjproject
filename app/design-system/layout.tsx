import type { Metadata } from "next";
import type { ReactNode } from "react";

/* The `.dev.tsx` page extension, gated in next.config.ts, keeps this route out of the production export. It is
   built for previews, so it must not be indexable there. */
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
