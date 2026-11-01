/* The export gate's rules for the two lab routes, `/thread` and `/design-system`: built for dev and Vercel
 * previews only. Kept out of the gate script so they can be tested; the gate decides the mode. */

/* A static route emits `out/<route>.html`, `out/<route>.txt` and an `out/<route>/` directory of RSC payloads. */
export const LAB_OUTPUTS = [
  "out/thread.html",
  "out/thread.txt",
  "out/thread",
  "out/design-system.html",
  "out/design-system.txt",
  "out/design-system",
];

/** @param {boolean} preview */
export const labForbidden = (preview) => (preview ? [] : LAB_OUTPUTS);

/* The gallery composes no section and carries no frame, so it is not one of the gate's route rows. A preview
 * build must show the page is the gallery and not a 404 body in its place: a page that calls `notFound()` still
 * exports a file at its path. */
const GALLERY_HEADING = /<h1[^>]*>Design System<\/h1>/;
const GALLERY_ROBOTS = "noindex, nofollow";

/** @param {string} html */
export function galleryVerdict(html) {
  const heading = GALLERY_HEADING.test(html);
  const robots = [
    ...html.matchAll(/<meta name="robots" content="([^"]*)"\s*\/?>/g),
  ].map((m) => m[1]);
  return {
    ok: heading && robots.length === 1 && robots[0] === GALLERY_ROBOTS,
    heading,
    robots,
  };
}
