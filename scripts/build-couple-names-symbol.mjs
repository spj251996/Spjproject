/* Emits components/icons/couple-names-symbol.tsx from tmp/aaa/source/Names-svg.svg once. Run by hand;
   not a build step. Each symbol gets a TIGHT viewBox around its own word-group, re-origined to
   0,0, so a <use> whose width/height equal that viewBox places the group at 1:1 scale. */
import { readFileSync, writeFileSync } from "node:fs";

const src = readFileSync("tmp/aaa/source/Names-svg.svg", "utf8");
const paths = [...src.matchAll(/<path d="([^"]*)"/g)].map((m) =>
  m[1].replace(/\s+/g, " ").trim(),
);
if (paths.length !== 5)
  throw new Error(`expected 5 paths, found ${paths.length}`);

/* Measured in a real engine, scripts/measure-couple-names-bbox.mjs, in the file's own viewBox units. */
const GROUPS = [
  {
    id: "names-sebastian",
    paths: [0, 1],
    x: 0.32,
    y: 0.19,
    w: 599.68,
    h: 190.11,
    what: "Sebastian and the dot on its i",
  },
  {
    id: "names-ampersand",
    paths: [2],
    x: 271.35,
    y: 160.17,
    w: 101.43,
    h: 84.63,
    what: "the ampersand",
  },
  {
    id: "names-flemy",
    paths: [3, 4],
    x: 101.36,
    y: 262.08,
    w: 415.43,
    h: 183.42,
    what: "the F of Flemy, then lemy",
  },
];

const SOURCE_TRANSFORM = "translate(0,446) scale(0.1,-0.1)";

const header = `/* THE COUPLE'S NAMES, drawn. Source: the owner's potrace conversion of the legacy site's raster
   — there is no font and no vector original, and \`legacy-html/index.html\` holds only a 780x580 PNG
   inline as a data URI. Generated once from \`tmp/aaa/source/Names-svg.svg\` by
   \`scripts/build-couple-names-symbol.mjs\`; the SVG is gitignored, so this file is the only copy of the
   geometry. A re-trace must re-run that script, not hand-edit these paths.

   SPLIT INTO THE THREE WORD-GROUPS THE TRACE ALREADY SEPARATES, which is what lets ONE source serve
   both pages — stacked inside the invite's \`<h1>\`, re-laid on one line at Wishes — by translation
   alone. No redraw and no second trace.

   Each symbol carries the file's own \`${SOURCE_TRANSFORM}\` (potrace's flipped,
   tenfold space) composed with a translate that re-origins its group on 0,0, and a viewBox tight to
   that group's measured ink. A \`<use>\` whose width and height equal the viewBox therefore places
   the group at 1:1 — which is what makes the two layouts in \`couple-names.tsx\` pure placement
   arithmetic rather than nested scaling.

   \`fill="currentColor"\`, never the traced \`#000000\`: the call site colours it, which is also what
   lets a later palette change reach it.

   Mounted once in the root layout for the reason \`sprig-symbol.tsx\` records — a \`<use>\` resolves
   against the document, and this one renders in two sections, so inlining the geometry would ship
   it twice. */

export function CoupleNamesSymbol() {
  return (
    <svg
      aria-hidden
      height="0"
      role="presentation"
      style={{ position: "absolute" }}
      width="0"
    >
      <defs>
`;

const body = GROUPS.map((g) => {
  const inner = g.paths
    .map((i) => `            <path d="${paths[i]}" />`)
    .join("\n");
  return `        {/* ${g.what} — measured ink ${g.w} x ${g.h} at ${g.x}, ${g.y} in the source box */}
        <symbol id="${g.id}" viewBox="0 0 ${g.w} ${g.h}">
          <g fill="currentColor" transform="translate(${-g.x},${-g.y}) ${SOURCE_TRANSFORM}">
${inner}
          </g>
        </symbol>`;
}).join("\n");

writeFileSync(
  "components/icons/couple-names-symbol.tsx",
  `${header}${body}
      </defs>
    </svg>
  );
}
`,
);
console.log("wrote components/icons/couple-names-symbol.tsx");
