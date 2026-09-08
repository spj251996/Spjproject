import type { Metadata } from "next";
import { Mrs_Saint_Delafield, PT_Sans, PT_Serif } from "next/font/google";
import "./globals.css";

/* The three families bind straight onto the role tokens app/styles/tokens.css declares
   (`--font-script`, `--font-serif`, `--font-sans`) — the token layer publishes those names as the
   contract for this file and carries only fallback stacks until it is satisfied. `display: "swap"`
   keeps the fallback face visible instead of flashing invisible text (DESIGN.md → Technical
   Conventions). */

const script = Mrs_Saint_Delafield({
  variable: "--font-script",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  fallback: ["cursive"],
});

const serif = PT_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  fallback: ["Georgia", "serif"],
});

const sans = PT_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Sebastian & Flemy",
  description: "Wedding invitation for Sebastian and Flemy.",
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
