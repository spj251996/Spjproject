import type { Metadata } from "next";
import { Corinthia, Cormorant_Garamond, Source_Sans_3 } from "next/font/google";
import "./globals.css";

/* Corinthia needs an explicit weight because it ships as static faces only; the other two are
   variable, and omitting `weight` loads the whole axis. */

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

/* The italic axis is loaded, not synthesised: the closing sign-off's lead line is set in italic body,
   and a browser-obliqued normal face reads as a slanted regular at that size. */
const sans = Source_Sans_3({
  variable: "--font-sans",
  subsets: ["latin"],
  style: ["normal", "italic"],
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
