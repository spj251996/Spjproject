import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/* The drawn names replace two script type roles. Five things can go wrong here and only one of them
   shows on screen:

   - the `<h1>` loses its accessible name, so the page's one meaningful heading announces nothing
     where the couple's names are. The asset is `aria-hidden` by design, so the name has to come
     from real text, and exactly once — a second copy stutters.
   - the traced `#000000` survives, and no colour token can reach the asset.
   - the two layouts' placement arithmetic drifts from the measured ink, which no render would flag
     because a wrong gap still draws three words in a row.
   - today's script markup is deleted rather than kept, which removes `/preview`'s lever-2
     alternate before the couple have chosen.
   - the alternate is left visible, so `/` paints the asset AND the script text at once. */

/* COMMENTS ARE STRIPPED BEFORE ANY SOURCE MATCH, and that is not tidiness. Every claim below
   names the thing it forbids in order to explain itself — `#000000`, a second `sr-only` — so a
   plain read matches the prose and the test passes or fails on its own explanation. This file was
   written with that bug twice before it was written without it, and it is the fourth time this
   project has recorded the trap. */
function code(path: string): string {
  return readFileSync(path, "utf8")
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const SYMBOL = code("components/icons/couple-names-symbol.tsx");
const NAMES = code("components/ui/couple-names.tsx");
const INVITE = code("app/_sections/invite.tsx");

test("every word-group takes currentColor, so a colour token reaches all three", () => {
  assert.doesNotMatch(
    SYMBOL,
    /#000000/,
    "the traced fill must become currentColor",
  );
  /* COUNTED, not merely present. Dropping the fill from ONE symbol left the other two matching
     and this claim passed — so one word of the couple's names would have painted black on a tan
     card with nothing failing anywhere. Proven by that mutation, which is why it is a count. */
  assert.equal(
    (SYMBOL.match(/fill="currentColor"/g) ?? []).length,
    3,
    "each of the three word-groups needs its own currentColor fill",
  );
});

test("one source serves both pages — three word-groups, five paths, no redraw", () => {
  for (const id of ["names-sebastian", "names-ampersand", "names-flemy"]) {
    assert.match(SYMBOL, new RegExp(`id="${id}"`), `missing symbol ${id}`);
  }
  assert.equal(
    (SYMBOL.match(/<path/g) ?? []).length,
    5,
    "the traced file is five paths; a redraw or a second trace is not wanted",
  );
});

/* THE PLACEMENT IS ASSERTED AS ARITHMETIC OVER THE MEASURED INK, not as remembered numbers. The
   single-line box was measured at 1156.94 x 190.11 (6.09:1) and the gaps at ~20.2 units; a drifted
   constant would still draw three words in a row, so nothing visual catches it. */
test("the single-line layout's box is the sum of its parts", () => {
  const num = (name: string): number => {
    const m = new RegExp(`${name}[^\\n]*?([\\d.]+)`).exec(NAMES);
    assert.notStrictEqual(m, null, `no ${name} in couple-names.tsx`);
    return Number((m as RegExpExecArray)[1]);
  };
  const widths = [
    num("SEBASTIAN = \\{ w:"),
    num("AMPERSAND = \\{ w:"),
    num("FLEMY = \\{ w:"),
  ];
  const gap = num("GAP =");
  const total = widths[0] + widths[1] + widths[2] + 2 * gap;
  assert.ok(
    Math.abs(total - 1156.94) < 1,
    `the line box should sum to 1156.94, got ${total.toFixed(2)}`,
  );
  assert.ok(
    Math.abs(total / 190.11 - 6.09) < 0.02,
    `the measured line ratio is 6.09:1, got ${(total / 190.11).toFixed(3)}`,
  );
});

/* The two widths are `em` of the call site's own role, which is what keeps the asset on the names
   scale the owner settled in Half 1 rather than on a size chosen in this component. Both are
   measured against the lockup being replaced — 236.2px at 94px and 276.4px at 110px for the stack,
   260.8 / 335.2 / 298px at 56 / 72 / 64px for the line — so a drifted literal silently resizes the
   couple's names at every tier with nothing else to notice. */
test("the asset is sized in em of the role it replaces, at the measured ratios", () => {
  assert.ok(
    Math.abs(236.2 / 94 - 2.513) < 0.002 &&
      Math.abs(276.4 / 110 - 2.513) < 0.002,
    "the stacked ratio must still be what the old lockup measured",
  );
  assert.ok(
    Math.abs(260.8 / 56 - 4.656) < 0.002 && Math.abs(298 / 64 - 4.656) < 0.002,
    "the line ratio must still be what the old signature measured",
  );
  assert.match(
    NAMES,
    /w-\[2\.513em\]/,
    "the stacked lockup's width literal drifted",
  );
  assert.match(
    NAMES,
    /w-\[4\.656em\]/,
    "the single line's width literal drifted",
  );
  /* NO CONTAINER CAP, AND THAT IS A RULING RATHER THAN AN OVERSIGHT. `w-[min(2.513em,100%)]` was
     built and reverted: it fixes a real overflow — the invite's stacked lockup is 236.2px at the
     phone tier against a content box that measures 176px at 320x844 — but it makes the lockup's
     height GROW with the window over the capped range, and `measure:fit` throws on exactly that
     ("phone portrait regime 1 stands taller than regime 0 at a wider width"), because the frame's
     model requires content height to FALL as width rises. A media query cannot rescue it either:
     a step still jumps the height upward at the boundary.
     So the 320px overflow stands as a Known Gap, the owner's to price, and this assertion exists
     to stop the cap being re-added as an obvious fix that silently breaks the fit generator. */
  for (const w of NAMES.match(/w-\[[^\]]+\]/g) ?? []) {
    assert.doesNotMatch(
      w,
      /min\(/,
      `a container cap on a lockup width breaks measure:fit's monotonicity guard: ${w}`,
    );
  }
});

/* THE DILATION IS LOAD-BEARING AND LOOKS LIKE DECORATION, which is exactly how it would get
   removed. The trace's thinnest strokes measure ~2.0 viewBox units, and a stroke under one DEVICE
   pixel washes out on an ordinary dpr-1 monitor. A later tidy-up that drops the stroke returns the
   lettering to washing out on desktop, and nothing visual would fail.

   ASSERTED PER CALL SITE, because one shared value cannot give one optical weight: each lockup
   renders at its own scale, so the same unit count lands ~1.75x heavier at the invite than at
   Wishes. The owner read that off the page before the arithmetic did. The px-per-unit figures are
   each lockup's SMALLEST measured rendering. */
const SITES = [
  {
    file: "app/_sections/invite.tsx",
    pxPerUnit: 0.3939,
    where: "the invite's stacked lockup at phone, 236.2px across 599.68 units",
  },
  {
    file: "app/_sections/wishes.tsx",
    pxPerUnit: 0.2253,
    where: "Wishes' line at phone, 260.7px across 1156.94 units",
  },
];

test("the lettering is dilated, in the same ink and with joins that do not spike", () => {
  assert.match(
    NAMES,
    /stroke="currentColor"/,
    "the dilation paints in the same ink as the fill",
  );
  assert.match(
    NAMES,
    /strokeLinejoin="round"/,
    "a mitered join turns each cusp of the handwriting into a spike",
  );
  assert.match(
    NAMES,
    /strokeWidth=\{strokeUnits \* 10\}/,
    "the lever must reach the paint — the paths live inside the source group's own scale(0.1)",
  );
});

test("every call site sets its own dilation, between its pixel floor and the taper's ceiling", () => {
  for (const site of SITES) {
    const m = /strokeUnits=\{([\d.]+)\}/.exec(code(site.file));
    assert.notStrictEqual(m, null, `${site.file} does not set strokeUnits`);
    const units = Number((m as RegExpExecArray)[1]);
    const hairline = (2.0 + units) * site.pxPerUnit;
    /* 0.9 rather than 1.0, and the gap is recorded rather than tuned away: Wishes ships 2.2 by the
       owner's eye on a render, which lands it at 0.95px — a hair under the floor the figures
       derive. Their judgement governs; this bound exists to catch a REGRESSION below it, not to
       restate the floor. 2.5 is the number if Wishes ever reads washed out on a monitor. */
    assert.ok(
      hairline >= 0.9,
      `${site.where}: ${units} units leaves the thinnest stroke at ${hairline.toFixed(2)}px — it greys out there`,
    );
    /* Dilation is uniform, so it adds the same width to a hairline as to a stem: too much of it
       flattens the taper into a monoline and closes the counters. Measured on an 1800px raster,
       distinct ink runs fall 3.4% at 2.2 units and 16.5% at 8, where limbs fuse. */
    assert.ok(
      units <= 4,
      `${site.file}: ${units} units flattens the taper and closes the counters`,
    );
  }
});

test("the two sites do NOT share one dilation", () => {
  /* The whole finding: a shared constant reads "too thick" at the invite and "ok" at Wishes,
     because the invite renders its drawing far larger relative to its own viewBox. Equalising them
     again is the regression this guards. */
  const [a, b] = SITES.map(
    (site) => /strokeUnits=\{([\d.]+)\}/.exec(code(site.file))?.[1],
  );
  assert.notEqual(
    a,
    b,
    "one value for both lockups is one weight at neither of them",
  );
});

test("the names are text to a reader and decoration to the paint layer", () => {
  assert.equal(
    (NAMES.match(/sr-only/g) ?? []).length,
    1,
    "exactly one accessible copy of the names — a second makes the h1 stutter",
  );
  assert.match(
    NAMES,
    /aria-hidden/,
    "the drawn names must not reach the accessibility tree",
  );
});

test("the invite's h1 holds the asset and is still the page's only h1", () => {
  assert.match(INVITE, /<CoupleNames/, "the invite must render the asset");
  assert.equal(
    (INVITE.match(/<h1/g) ?? []).length,
    1,
    "exactly one h1 per page",
  );
  const h1 = INVITE.indexOf("<h1");
  const asset = INVITE.indexOf("<CoupleNames", h1);
  const close = INVITE.indexOf("</h1>", h1);
  assert.ok(
    asset !== -1 && asset < close,
    "the asset must sit INSIDE the h1, not beside it",
  );
});

test("the typeset markup is still hidden, and is now dead rather than pending", () => {
  /* THE NAMES LEVER WAS DROPPED, NOT DECIDED (owner, 2026-10-10: ship only drawn, no options), so
     this markup has no consumer on any route from that moment. It stays in the tree and stays
     HIDDEN — `app/couple-names.css`'s `display: none` is now the only thing keeping it off the
     page, where before `/preview` un-hid it — and `scripts/retire-register.mjs` carries both it
     and `splitCoupleNames` as `unused`, which is what schedules the deletion rather than leaving
     it to look like a pending answer.
     THE HIDE AND THE MARKUP MUST GO TOGETHER. Removing the stylesheet alone would PAINT both the
     drawn asset and the typeset script at once, which is why neither span is registered
     separately and why this test asserts the pair rather than either half. */
  for (const file of ["app/_sections/invite.tsx", "app/_sections/wishes.tsx"]) {
    const src = readFileSync(file, "utf8");
    assert.match(src, /data-names-alt/, `${file} lost its alternate's marker`);
    assert.match(
      src,
      /@\/app\/couple-names\.css/,
      `${file} renders the alternate without importing the rule that hides it`,
    );
  }
  assert.match(
    readFileSync("app/couple-names.css", "utf8"),
    /\[data-names-alt\][^{]*\{[^}]*display:\s*none/,
    "app/couple-names.css must hide the alternate on the published page",
  );
  /* That nothing UN-hides it any more is `app/preview/preview.css`'s business and is asserted in
     `app/preview/preview-route.test.ts`, which owns that file. Reading a route-scoped stylesheet
     from here would make this test depend on a file that need not exist — and it would throw
     rather than skip at any commit before the route lands. */
});
