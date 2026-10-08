import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import {
  Corinthia,
  Libre_Baskerville,
  Noto_Serif_Malayalam,
  Playfair_Display,
} from "next/font/google";
import { SprigSymbol } from "@/components/icons";
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
   size. Libre Baskerville ships 400, 700 and 400 italic and nothing between, so a role set in it
   has two weights and no middle: CSS resolves an unavailable 500 down to 400 and a 600 up to 700
   rather than synthesising either. That is why the eyebrow's step to 700 (owner, 2026-10-07) was
   the whole step, and why a later "soften it slightly" has nothing here to land on. */
const sans = Libre_Baskerville({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
  fallback: ["Georgia", "serif"],
});

/* The three Latin faces carry no Malayalam glyphs, so the ritual titles' second script needs a
   family of its own.

   Weight 400 only — 20KB, Malayalam subset. The design uses one weight, and loading 400+600
   would be 42KB for nothing. Subsetting to the ~19 codepoints the five titles use would reach
   3-6KB and was REJECTED: it breaks silently the day a title changes or a sixth ritual lands,
   and a missing glyph renders as a box on a title nobody re-checked. */
const malayalam = Noto_Serif_Malayalam({
  variable: "--font-malayalam",
  subsets: ["malayalam"],
  weight: "400",
  display: "swap",
});

/* The invitation is shared by link only. robots.txt stops the crawl; this states the same intent
   to anything that fetches the page regardless, and metadataBase is what resolves the OpenGraph
   image to the absolute URL a preview fetcher needs. https, not http: Vercel redirects http, and
   an http base would emit http image URLs that some clients refuse to load. */
const SITE_URL = "https://flemy-weds-sebastian.vercel.app";

/* THE OPENING SEQUENCE'S GATE. The sequence is an ENTRANCE to the invite; a reader who reloads
   part-way down the page is not arriving, and re-running it hides the thread they are actually
   looking at for the whole 1600ms (`.pageRoot` covers all of `<main>`, so its fade blanks the
   thread in every section at once, not just the invite's).

   WHY AN INLINE SCRIPT RATHER THAN AN EFFECT, and why it waits for `DOMContentLoaded`: the browser
   restores a reloaded page's scroll position ASYNCHRONOUSLY, so a check that runs as this script is
   parsed reads 0 and defeats itself — measured, not assumed: at document-start `scrollY` reads 0,
   and it reads the true restored 2808 from `readyState === "interactive"` onward, ~111ms in. The
   sequence's own earliest step is the flowers' settle at 200ms (`app/invite.css`), so a gate applied
   at `DOMContentLoaded` lands before ANY step begins. It is an inline script rather than a React
   effect so it does not wait on hydration, whose timing is nobody's contract.

   `scrollY > 0` is the threshold, and deliberately the SAME one `page-thread.tsx` already applies to
   the thread's own timed draw — one definition of "loaded already scrolled", not two that can drift.
   A more forgiving threshold (skip only once the invite has left the viewport) would be a fresh
   design value, which is the owner's to set.

   The attribute SUBTRACTS the animation rather than adding an override: every rule it gates stops
   matching, so each layer sits in its own un-animated base state — which is already the finished
   state, and is exactly where reduced motion and a no-JS reader land. One code path, three ways in.
   A reader with JS disabled never sets it and keeps today's CSS-only sequence, which is the only
   thing that ever animates their static fallback thread. */
const SKIP_OPENING_WHEN_SCROLLED = `addEventListener("DOMContentLoaded",function(){if(window.scrollY>0){document.documentElement.dataset.openingSkipped="";}});`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Flemy & Sebastian",
  description: "You’re invited — 9th January 2027, Koothattukulam, Keralam",
  robots: { index: false, follow: false },
  /* No twitter block is declared, but Next synthesises twitter:* from openGraph regardless, so the
     export carries them. Left alone rather than suppressed: they are free, they agree with the og:
     values, and some clients read them as a fallback. Twitterbot itself is blocked in robots.txt,
     so this advertises nothing to X. */
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: SITE_URL,
    /* Split from the document title deliberately: "…are getting married" is a good preview headline
       and a clumsy browser-tab label. The card above it already carries the names in the script
       face, so the title carries the occasion and the description carries the date and the town —
       together the pair holds names, date and city (PROJECT.md → Link Sharing) with nothing said
       twice. The card shows the state; this says the town the card omits. */
    title: "Flemy & Sebastian are getting married",
    description: "You’re invited — 9th January 2027, Koothattukulam, Keralam",
    images: [
      {
        url: "/og-card.jpg",
        width: 1200,
        height: 630,
        alt: "Flemy and Sebastian, 9th January 2027, Keralam",
      },
    ],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${script.variable} ${serif.variable} ${sans.variable} ${malayalam.variable} h-full antialiased`}
      /* `SKIP_OPENING_WHEN_SCROLLED` above sets `data-opening-skipped` on this element before React
         hydrates, so the server's markup and the client's differ by that one attribute and React's
         development build reports a mismatch on every scrolled reload. Production is silent — React
         compares attributes only in development — and the attribute survives either way ("this won't
         be patched up"), which is why the skip has always worked. Suppression is scoped one level
         deep, so it covers this element's own attributes and nothing inside it; the cost is that a
         future genuine mismatch ON `<html>` would also go quiet.
         Do NOT "fix" this by reading `window.scrollY` synchronously instead: scroll restoration has
         not happened at head-parse time, so it reads 0 and the whole skip silently stops working. */
      suppressHydrationWarning
    >
      {/* Vercel Web Analytics is first-party on Vercel: the script and its beacon are same-origin
          under `/_vercel/*`, so no CSP allowance is needed and no third party receives guest data —
          which matters on a site whose whole policy is that it is shared by link and listed
          nowhere. It is cookieless and counts visits rather than identifying visitors. */}
      <body className="min-h-full flex flex-col">
        <script>{SKIP_OPENING_WHEN_SCROLLED}</script>
        <SprigSymbol />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
