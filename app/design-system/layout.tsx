import type { Metadata } from "next";
import type { ReactNode } from "react";

/* Its own layout, isolated from any site chrome the root layout later grows — the gallery is a
   dev-only reference, never a page in the invitation's own composition. Non-indexable is defense
   in depth: page.tsx's production env-gate is the primary exclusion (stack-adapters.md → (e)), but
   if this route ever leaked into a build anyway, it must still never be indexed. */
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
