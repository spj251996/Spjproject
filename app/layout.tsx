import type { Metadata } from "next";
import { Corinthia, Cormorant_Garamond, Source_Sans_3 } from "next/font/google";
import "./globals.css";

/* The three families bind straight onto the role tokens app/styles/tokens.css declares
   (`--font-script`, `--font-serif`, `--font-sans`) — the token layer publishes those names as the
   contract for this file and carries only fallback stacks until it is satisfied. `display: "swap"`
   keeps the fallback face visible instead of flashing invisible text (DESIGN.md → Technical
   Conventions). */

/* Corinthia declares an explicit weight because it ships as static faces only; the other two are
   variable, and omitting `weight` there loads the whole axis rather than pinning single cuts. */

const script = Corinthia({
  variable: "--font-script",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  fallback: ["cursive"],
});

const serif = Cormorant_Garamond({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
  fallback: ["Georgia", "serif"],
});

const sans = Source_Sans_3({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Flemy & Sebastian",
  description: "Wedding invitation for Flemy and Sebastian.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${script.variable} ${serif.variable} ${sans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
