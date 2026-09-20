import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import {
  Corinthia,
  Libre_Baskerville,
  Playfair_Display,
} from "next/font/google";
import "./globals.css";

/* Corinthia and Libre Baskerville ship as static faces and need explicit weights; Playfair Display
   is variable, so omitting `weight` loads the whole axis. */

const script = Corinthia({
  variable: "--font-script",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  fallback: ["cursive"],
});

const serif = Playfair_Display({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
  fallback: ["Georgia", "serif"],
});

/* The italic cut is loaded, not synthesised: the closing sign-off's lead line and the invite's
   citation are set in italic, and a browser-obliqued normal face reads as a slanted regular at that
   size. Libre Baskerville ships 400, 700 and 400 italic — there is no 500, which is why
   `{typography.eyebrow}` is set at 400. */
const sans = Libre_Baskerville({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
  fallback: ["Georgia", "serif"],
});

/* The invitation is shared by link only. robots.txt stops the crawl; this states the same intent
   to anything that fetches the page regardless, and metadataBase is what resolves the OpenGraph
   image to the absolute URL a preview fetcher needs. https, not http: Vercel redirects http, and
   an http base would emit http image URLs that some clients refuse to load. */
const SITE_URL = "https://flemy-weds-sebastian.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Flemy & Sebastian",
  description: "Wedding invitation for Flemy and Sebastian.",
  robots: { index: false, follow: false },
  /* No twitter block is declared, but Next synthesises twitter:* from openGraph regardless, so the
     export carries them. Left alone rather than suppressed: they are free, they agree with the og:
     values, and some clients read them as a fallback. Twitterbot itself is blocked in robots.txt,
     so this advertises nothing to X. */
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: SITE_URL,
    title: "Flemy & Sebastian",
    description: "Wedding invitation for Flemy and Sebastian.",
    images: [
      {
        url: "/og-card.jpg",
        width: 1200,
        height: 630,
        alt: "Flemy and Sebastian, Saturday 9th January 2027, Koothattukulam",
      },
    ],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${script.variable} ${serif.variable} ${sans.variable} h-full antialiased`}
    >
      {/* Vercel Web Analytics is first-party on Vercel: the script and its beacon are same-origin
          under `/_vercel/*`, so no CSP allowance is needed and no third party receives guest data —
          which matters on a site whose whole policy is that it is shared by link and listed
          nowhere. It is cookieless and counts visits rather than identifying visitors. */}
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
