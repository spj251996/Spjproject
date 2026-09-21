/* Extension-qualified, unlike the rest of components/: plain node resolves a relative import only
   with its extension, and this module stays importable outside the app's bundler. */
import {
  BREAKPOINT_REM,
  CAPS,
  type CardRectangle,
  cardReveal,
  type FitRegime,
  type FrameLayout,
  fitRectangles,
  formatPx,
  GROUND_HALVING,
  type MeasuredFit,
  mountShows,
  type Orientation,
  pairsSideBySide,
  regimesFor,
  revealFor,
  SIDE_GROUND_MULTIPLE,
  smallestPadding,
  tallWindowClasses,
  type WindowClass,
  windowClasses,
} from "./mounted-sheet-frame.ts";

/* One section's frame as a static stylesheet, generated from its measured fit so that no threshold
   is hand arithmetic. Nothing here reads the page: the output is plain CSS that paints the final
   state on first render.

   The window decides every step:
   - The ground is a media query per window class, because it asks whether a card that is not on
     screen — the full-ground one — would hold the content.
   - The padding is decided by the card the window gives: its height as a media query, its width
     read from the box.

   The box and the card only set minimum heights, so content taller than its fit predicts lengthens
   the card and its section instead of covering the section below.

   Every selector starts from the section's scope class, so two framed sections on one page never
   share a threshold. The stylesheet is unlayered, so it wins over the utility and component layers
   on the elements it styles. */

export const FRAME_CLASS = {
  box: "mounted-sheet-frame__box",
  mount: "mounted-sheet-frame__mount",
  leaf: "mounted-sheet-frame__leaf",
  crease: "mounted-sheet-frame__crease",
  sheet: "mounted-sheet-frame__sheet",
} as const;

export function frameScopeClass(fit: MeasuredFit): string {
  return `mounted-sheet-frame--${fit.section}`;
}

const GROUND = "--mounted-sheet-ground";
const GROUND_VALUE = `var(${GROUND})`;

/* `--ring-block`/`--ring-side` republish the same padding the frame scope div already carries, as
   custom properties an absolutely-positioned child (the botanical layer) can read by inheritance —
   one source for the band, never a second ladder. `--ring-cap` is a local indirection so the
   landscape side-padding expression (`max(...)`) is written once and only the height-cap token it
   reads changes per width band, rather than the whole expression repeating. */
const RING_BLOCK = "--ring-block";
const RING_SIDE = "--ring-side";
const RING_CAP = "--ring-cap";

/* The window's own two bands, before the ring republishes them for the botanical layer. A portrait
   window sets them apart; landscape leaves both at the one ground it has always used. */
const GROUND_BLOCK = "--ground-block";
const GROUND_INLINE = "--ground-inline";

/* The card's minimum height from the window: every viewport-height term is `svh`, so nothing in the
   frame moves as a phone's toolbar hides. A landscape card's is also capped — at the compact
   laptop tier's own, smaller cap tokens, `{breakpoints.lg}` to `{breakpoints.xl}`; the base cap
   everywhere else (mobile, tablet, wide). */
const CARD_HEIGHT = `calc(100svh - 2 * var(${GROUND_BLOCK}))`;
const CAPPED_CARD_HEIGHT = `min(var(--card-height-cap), ${CARD_HEIGHT})`;
const COMPACT_CAPPED_CARD_HEIGHT = `min(var(--card-height-cap-compact), ${CARD_HEIGHT})`;
const COMPACT_WIDTH_QUERY = `(${BREAKPOINT_REM.lg}rem <= width < ${BREAKPOINT_REM.xl}rem)`;

/* An emitted value off the spacing scale fails generation instead of shipping. Keyed by pixel
   value, because the arithmetic needs the number a media query cannot read from the token — a
   spacing token change must change this map too. */
/* Exported for the test that checks this map against `app/styles/tokens.css` itself, in both
   directions, rather than trusting one hand-picked step. */
export const SPACING_TOKEN: Readonly<Record<number, string>> = {
  0: "--spacing-0",
  4: "--spacing-space-3xs",
  8: "--spacing-space-2xs",
  12: "--spacing-space-xs",
  16: "--spacing-space-sm",
  24: "--spacing-space-md",
  32: "--spacing-space-lg",
  48: "--spacing-space-xl",
  64: "--spacing-space-2xl",
  96: "--spacing-space-3xl",
  128: "--spacing-space-4xl",
  172: "--spacing-space-5xl",
};

function spacing(px: number): string {
  const token = SPACING_TOKEN[px];
  if (token === undefined) {
    throw new Error(
      `mounted-sheet-frame-css: ${formatPx(px)} is not on the spacing scale`,
    );
  }
  return `var(${token})`;
}

/* Exported so a test can exercise the real lookup `mountedSheetFrameCss` uses, rather than reading
   `SPACING_TOKEN` and inferring the throw behavior. */
export function spacingTokenFor(px: number): string {
  return spacing(px);
}

/* A condition is a parenthesised query fragment, or a constant once simplified. Every compound is
   wrapped in its own parentheses, so `and`, `or` and `not` never meet at one level. */
type Condition = string | boolean;

function not(condition: Condition): Condition {
  return typeof condition === "boolean" ? !condition : `(not ${condition})`;
}

function any(...conditions: Condition[]): Condition {
  if (conditions.includes(true)) return true;
  const terms = conditions.filter((c): c is string => c !== false);
  if (terms.length === 0) return false;
  return terms.length === 1 ? terms[0] : `(${terms.join(" or ")})`;
}

function all(...conditions: Condition[]): Condition {
  if (conditions.includes(false)) return false;
  const terms = conditions.filter((c): c is string => c !== true);
  if (terms.length === 0) return true;
  return terms.length === 1 ? terms[0] : `(${terms.join(" and ")})`;
}

function clears(
  rectangles: readonly CardRectangle[],
  widthOffset: number,
  heightOffset: number,
): Condition {
  return any(
    ...rectangles.map(
      (rectangle) =>
        `((width >= ${formatPx(rectangle.minCardWidth + widthOffset)}) and (height >= ${formatPx(rectangle.minCardHeight + heightOffset)}))`,
    ),
  );
}

function mediaRule(
  prelude: string,
  condition: Condition,
  body: string,
): string {
  if (condition === false) return "";
  const query = condition === true ? prelude : `${prelude} and ${condition}`;
  return `${query} {\n${body}\n}`;
}

function orientationQuery(landscape: boolean): string {
  return `(orientation: ${landscape ? "landscape" : "portrait"})`;
}

function orientationName(landscape: boolean): Orientation {
  return landscape ? "landscape" : "portrait";
}

/* Does this window's card, at the given ground, hold the content at the smallest padding? Stated in
   window terms, so it can decide the ground for a card that is not on screen. It assumes the frame
   spans the full window width, which a classic scrollbar narrows.

   A portrait card is the window less the ground on every side. A landscape card is
   min(width cap, window width − 2 × max(double the ground, (window height − height cap) / 2)) wide
   and min(height cap, window height − 2 × ground) tall. Up to height cap + 4 × ground the centring
   term never exceeds double the ground, so the ground term alone decides the width, and a media
   query can state it. Above that band the centring term decides, and that needs window width minus
   window height, which CSS cannot state. A rectangle no wider than the height cap still clears
   there, because a landscape window is at least as wide as it is tall. A wider one is counted only
   inside the band: conservative, since a window above the band
   may keep full ground where halving would have fitted, and nothing is hidden, because the padding
   chain reads the card's real width. */
function windowFits(
  windowClass: WindowClass,
  hero: boolean,
  layout: FrameLayout,
  pressed: boolean,
  landscape: boolean,
): Condition {
  const rectangles = fitRectangles(
    regimesFor(windowClass.regimes, orientationName(landscape)),
    cardReveal(windowClass, hero, layout, landscape),
    smallestPadding(windowClass.groundTier),
    pairsSideBySide(layout, windowClass, landscape),
  );
  if (!landscape) {
    /* `clears` takes a width offset and a height offset separately: the inline band decides the
       card's width, the block band its height. */
    const portrait = windowClass.groundTier.portrait;
    return clears(
      rectangles,
      2 * (pressed ? portrait.inlinePressed : portrait.inline),
      2 * (pressed ? portrait.blockPressed : portrait.block),
    );
  }

  const ground = pressed
    ? windowClass.groundTier.ground * GROUND_HALVING
    : windowClass.groundTier.ground;
  const cap = CAPS[windowClass.widthTier];
  const band = `(height <= ${formatPx(cap.height + 2 * SIDE_GROUND_MULTIPLE * ground)})`;
  return any(
    ...rectangles
      .filter(
        (rectangle) =>
          rectangle.minCardWidth <= cap.width &&
          rectangle.minCardHeight <= cap.height,
      )
      .map((rectangle) =>
        all(
          `(width >= ${formatPx(rectangle.minCardWidth + 2 * SIDE_GROUND_MULTIPLE * ground)})`,
          `(height >= ${formatPx(rectangle.minCardHeight + 2 * ground)})`,
          rectangle.minCardWidth > cap.height ? band : true,
        ),
      ),
  );
}

/* True where the full-ground card does not fit and the halved one does. */
function halvingCondition(
  windowClass: WindowClass,
  hero: boolean,
  layout: FrameLayout,
  landscape: boolean,
): Condition {
  return all(
    not(windowFits(windowClass, hero, layout, false, landscape)),
    windowFits(windowClass, hero, layout, true, landscape),
  );
}

function orientationsOf(windowClass: WindowClass): boolean[] {
  const orientations: boolean[] = [];
  if (windowClass.portraitPossible) orientations.push(false);
  if (windowClass.landscapePossible) orientations.push(true);
  return orientations;
}

/* The class's own base rule sets all three properties to its landscape ground, so a window always
   has a band even before an orientation rule narrows it; the portrait rules then override the two
   band properties, and landscape needs no rule of its own because the base already is its value. */
function groundRules(
  windowClass: WindowClass,
  hero: boolean,
  layout: FrameLayout,
  scope: string,
): string {
  const tier = windowClass.groundTier;
  const ground = spacing(tier.ground);
  const rules = [
    `@media ${windowClass.media} {\n${scope} { ${GROUND}: ${ground}; ${GROUND_BLOCK}: ${ground}; ${GROUND_INLINE}: ${ground}; }\n}`,
  ];
  for (const landscape of orientationsOf(windowClass)) {
    const prelude = `@media ${windowClass.media} and ${orientationQuery(landscape)}`;
    if (!landscape) {
      rules.push(
        `${prelude} {\n${scope} { ${GROUND_BLOCK}: ${spacing(tier.portrait.block)}; ${GROUND_INLINE}: ${spacing(tier.portrait.inline)}; }\n}`,
      );
    }
    const halved = landscape ? spacing(tier.ground * GROUND_HALVING) : "";
    const pressedBody = landscape
      ? `${scope} { ${GROUND}: ${halved}; ${GROUND_BLOCK}: ${halved}; ${GROUND_INLINE}: ${halved}; }`
      : `${scope} { ${GROUND_BLOCK}: ${spacing(tier.portrait.blockPressed)}; ${GROUND_INLINE}: ${spacing(tier.portrait.inlinePressed)}; }`;
    rules.push(
      mediaRule(
        prelude,
        halvingCondition(windowClass, hero, layout, landscape),
        pressedBody,
      ),
    );
  }
  return rules.filter(Boolean).join("\n");
}

/* The mount's reveal comes from the same number the fit arithmetic used, so the two cannot drift.
   Where the mount does not show it loses its fill and its grain, and keeps `shadow-mount`. The
   grain is the surface's background image (app/styles/surfaces.css), which is why clearing
   `background-image` removes it; a grain drawn any other way would need a matching change here. */
function mountRules(
  windowClass: WindowClass,
  hero: boolean,
  scope: string,
): string {
  const mount = `${scope} > .${FRAME_CLASS.box} > .${FRAME_CLASS.mount}`;
  const fill = mountShows(windowClass, hero)
    ? ""
    : " background-color: transparent; background-image: none;";
  return `@media ${windowClass.media} {\n${mount} { padding: ${spacing(revealFor(windowClass, hero))};${fill} }\n}`;
}

function sheetSelector(scope: string, layout: FrameLayout): string {
  const mount = `${scope} > .${FRAME_CLASS.box} > .${FRAME_CLASS.mount}`;
  return layout === "pair"
    ? `${mount} > .${FRAME_CLASS.leaf} > .${FRAME_CLASS.sheet}`
    : `${mount} > .${FRAME_CLASS.sheet}`;
}

/* Each window class and orientation takes exactly one of two blocks, so neither has to undo the
   other.

   Side by side, the shared mount is the card and each leaf is only a column holding its sheet.

   Stacked, the mount stops being a surface and its gap is the ground below one card plus the
   ground above the next. The leaf rule strips fill and grain but never `box-shadow`, so each
   stacked card keeps `shadow-mount`. */
function pairLayoutRules(windowClass: WindowClass, scope: string): string {
  const mount = `${scope} > .${FRAME_CLASS.box} > .${FRAME_CLASS.mount}`;
  const leaf = `${mount} > .${FRAME_CLASS.leaf}`;
  const sheet = sheetSelector(scope, "pair");
  const crease = `${mount} > .${FRAME_CLASS.crease}`;
  const strip = "background-color: transparent; background-image: none;";

  return orientationsOf(windowClass)
    .map((landscape) => {
      const prelude = `@media ${windowClass.media} and ${orientationQuery(landscape)}`;
      if (pairsSideBySide("pair", windowClass, landscape)) {
        /* Side by side keeps the mount even at the phone ground tier, so its reveal is the width
           tier's own (`cardReveal`) rather than `revealFor`, which would fall to zero there. */
        const reveal = cardReveal(windowClass, false, "pair", landscape);
        return `${prelude} {
${mount} { flex-direction: row; gap: ${spacing(2 * reveal)}; padding: ${spacing(reveal)}; }
${leaf} { flex: 1 1 0; min-width: 0; padding: ${spacing(0)}; ${strip} box-shadow: none; }
${sheet} { justify-content: flex-start; }
${crease} { display: block; }
}`;
      }
      return `${prelude} {
${mount} { gap: calc(2 * var(${GROUND_BLOCK})); padding: ${spacing(0)}; ${strip} box-shadow: none; }
${leaf} { min-height: ${landscape ? CAPPED_CARD_HEIGHT : CARD_HEIGHT}; padding: ${spacing(0)}; background-color: transparent; background-image: none; }
}`;
    })
    .join("\n");
}

/* The largest padding step at which the card clears one of the fit's rectangles; the smallest
   where none is cleared.

   The height the window gives the card is the window height less the ground, capped in landscape,
   so it is a media query; a rectangle taller than the cap is reachable only in portrait. The card's
   width is read from the box, an inline-size container: a landscape card narrows by the window's
   height as well as its width once the height cap binds, which no media query can state, and the
   box's width is exactly the card's. Inline-size containment leaves the box's height to its
   content.

   Each rule sets one step for one rectangle, so a step's rectangles are alternatives, and larger
   steps come later and win — the cascade takes the largest step that fits, with no negation.

   One chain per orientation, each wrapped in its own `(orientation: …)` query and built from that
   orientation's own regimes, since their content differs. A class with no portrait windows gets no
   portrait chain. Where the ground halves, a second chain under the halving condition resets to the
   smallest step and climbs again against the halved card. */
function paddingRules(
  windowClass: WindowClass,
  hero: boolean,
  layout: FrameLayout,
  scope: string,
): string {
  const sheet = sheetSelector(scope, layout);
  const ascending = [...windowClass.groundTier.paddingSteps].reverse();

  /* One block per chain, so its condition is stated once and each rectangle nests inside it. A
     landscape chain skips a rectangle taller than the height cap: the box's landscape height is
     capped (frameRules), so no window is tall enough to actually hand the sheet that much room even
     though the rule's own height query could still be satisfied. Portrait's box is never capped, so
     its chain keeps every rectangle. */
  const chain = (
    prelude: string,
    blockBand: number,
    landscape: boolean,
    regimes: readonly FitRegime[],
    sideBySide: boolean,
    reveal: number,
  ): string => {
    const rules = [`${sheet} { padding: ${spacing(ascending[0])}; }`];
    for (const padding of ascending.slice(1)) {
      for (const rectangle of fitRectangles(
        regimes,
        reveal,
        padding,
        sideBySide,
      )) {
        if (
          landscape &&
          rectangle.minCardHeight > CAPS[windowClass.widthTier].height
        )
          continue;
        rules.push(
          `@media (height >= ${formatPx(rectangle.minCardHeight + 2 * blockBand)}) {\n@container (width >= ${formatPx(rectangle.minCardWidth)}) {\n${sheet} { padding: ${spacing(padding)}; }\n}\n}`,
        );
      }
    }
    return `${prelude} {\n${rules.join("\n")}\n}`;
  };

  const tier = windowClass.groundTier;
  const rules: string[] = [];
  for (const landscape of orientationsOf(windowClass)) {
    /* The height query asks whether the window's card clears a rectangle, so it offsets by whatever
       the card's height is measured from: the landscape ground, or portrait's block band. */
    const blockBand = landscape ? tier.ground : tier.portrait.block;
    const pressedBlockBand = landscape
      ? tier.ground * GROUND_HALVING
      : tier.portrait.blockPressed;
    const sideBySide = pairsSideBySide(layout, windowClass, landscape);
    const regimes = regimesFor(windowClass.regimes, orientationName(landscape));
    const reveal = cardReveal(windowClass, hero, layout, landscape);
    const base = `@media ${windowClass.media} and ${orientationQuery(landscape)}`;
    rules.push(chain(base, blockBand, landscape, regimes, sideBySide, reveal));

    const halving = halvingCondition(windowClass, hero, layout, landscape);
    if (halving === false) continue;
    const prelude = halving === true ? base : `${base} and ${halving}`;
    rules.push(
      chain(prelude, pressedBlockBand, landscape, regimes, sideBySide, reveal),
    );
  }
  return rules.join("\n");
}

function frameRules(scope: string, layout: FrameLayout): string {
  const box = `${scope} > .${FRAME_CLASS.box}`;
  const mount = `${box} > .${FRAME_CLASS.mount}`;
  const sheet = sheetSelector(scope, layout);

  /* Plain `center` first is the fallback for an engine that drops the `safe` declaration. `safe`
     keeps content that outgrows its box on the side the page can scroll to. */
  const safeCentre = `justify-content: center;
  justify-content: safe center;
  align-items: center;
  align-items: safe center;`;

  const pairBase =
    layout === "pair"
      ? `
${mount} > .${FRAME_CLASS.leaf} {
  flex: none;
  display: flex;
  flex-direction: column;
}
${mount} > .${FRAME_CLASS.crease} { display: none; }`
      : "";

  /* The box holds the card's minimum height and lengthens past it with its content. The mount and
     the sheet grow inside it as flex items, so each fills the height above it.

     `--ring-cap` carries whichever height-cap token the current width band reads, so the landscape
     side-padding formula (`max(...)`) is written once, on the general landscape rule, and the
     compact-width rule only swaps the token `--ring-cap` resolves to — the `max(...)` expression
     itself is never repeated. */
  return `${scope} {
  display: flex;
  flex-direction: column;
  min-height: 100svh;
  ${RING_BLOCK}: var(${GROUND_BLOCK});
  ${RING_SIDE}: var(${GROUND_INLINE});
  padding-block: var(${RING_BLOCK});
  padding-inline: var(${RING_SIDE});
  ${safeCentre}
}
@media (orientation: landscape) {
${scope} { ${RING_CAP}: var(--card-height-cap); ${RING_SIDE}: max(calc(${SIDE_GROUND_MULTIPLE} * ${GROUND_VALUE}), calc((100svh - var(${RING_CAP})) / 2)); }
}
@media (orientation: landscape) and ${COMPACT_WIDTH_QUERY} {
${scope} { ${RING_CAP}: var(--card-height-cap-compact); }
}
${box} {
  container-type: inline-size;
  position: relative;
  z-index: var(--z-content);
  flex: none;
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: ${CARD_HEIGHT};
}
@media (orientation: landscape) {
${box} {
  width: min(var(--container-content), 100%);
  min-height: ${CAPPED_CARD_HEIGHT};
}
}
@media (orientation: landscape) and ${COMPACT_WIDTH_QUERY} {
${box} {
  width: min(var(--container-content-compact), 100%);
  min-height: ${COMPACT_CAPPED_CARD_HEIGHT};
}
}
${mount} {
  flex: 1 0 auto;
  display: flex;
  flex-direction: column;
}
${sheet} {
  flex: 1 0 auto;
  display: flex;
  flex-direction: column;
  ${safeCentre}
}${pairBase}`;
}

/* Throws, failing the build, when the section cannot be framed as specified: an invalid fit, no
   tier line, a tier line not below its narrowest window, a value off the spacing scale, or a pair
   asked to be the hero. */
export function mountedSheetFrameCss(
  fit: MeasuredFit,
  hero: boolean,
  layout: FrameLayout = "single",
): string {
  /* Validates the fit, so it runs before anything reads the fit's section name — including the
     hero-pair guard below, which needs a valid fit to report one. */
  const classes = windowClasses(fit, layout);
  if (layout === "pair" && hero) {
    throw new Error(
      `mounted-sheet-frame-css: section "${fit.section}" asks for a hero pair, but a pair is never the hero — the opening section is a single card.`,
    );
  }
  const scope = `.${frameScopeClass(fit)}`;
  return [
    frameRules(scope, layout),
    ...classes.flatMap((windowClass) => [
      groundRules(windowClass, hero, layout, scope),
      layout === "pair"
        ? pairLayoutRules(windowClass, scope)
        : mountRules(windowClass, hero, scope),
      paddingRules(windowClass, hero, layout, scope),
    ]),
  ].join("\n");
}

/* Tall mode has no per-section threshold to scope, so every tall section shares one of two
   stylesheets — but `hero` is per-section, and two tall cards with different `hero` would otherwise
   collide on one class at identical specificity, with the later one in document order winning for
   both. Keying the scope class on `hero` keeps the two apart. */
export function tallScopeClass(hero: boolean): string {
  return `mounted-sheet-frame--tall-${hero ? "hero" : "section"}`;
}

/* A section that scrolls rather than fitting one window. No height query, no container query and no
   minimum card height: the card is its content's height, and the page scrolls past it. The landscape
   side ground is a flat double, with none of the fitted frame's leftover-from-the-height-cap term,
   because a tall card has no height cap to leave anything over. */
export function tallFrameCss(hero: boolean): string {
  const scope = `.${tallScopeClass(hero)}`;
  const box = `${scope} > .${FRAME_CLASS.box}`;
  const mount = `${box} > .${FRAME_CLASS.mount}`;
  const sheet = `${mount} > .${FRAME_CLASS.sheet}`;

  const base = `${scope} {
  display: flex;
  flex-direction: column;
  min-height: 100svh;
  ${RING_BLOCK}: var(${GROUND_BLOCK});
  ${RING_SIDE}: var(${GROUND_INLINE});
  padding-block: var(${RING_BLOCK});
  padding-inline: var(${RING_SIDE});
  justify-content: center;
  justify-content: safe center;
  align-items: center;
  align-items: safe center;
}
@media (orientation: landscape) {
${scope} { ${RING_SIDE}: calc(${SIDE_GROUND_MULTIPLE} * ${GROUND_VALUE}); }
}
${box} {
  position: relative;
  z-index: var(--z-content);
  flex: none;
  display: flex;
  flex-direction: column;
  width: 100%;
}
@media (orientation: landscape) {
${box} { width: min(var(--container-content), 100%); }
}
@media (orientation: landscape) and ${COMPACT_WIDTH_QUERY} {
${box} { width: min(var(--container-content-compact), 100%); }
}
${mount} {
  flex: 1 0 auto;
  display: flex;
  flex-direction: column;
}
${sheet} {
  flex: 1 0 auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  justify-content: safe center;
  align-items: center;
  align-items: safe center;
}`;

  const perClass = tallWindowClasses(hero).map((windowClass) => {
    const fill = windowClass.mountShows
      ? ""
      : " background-color: transparent; background-image: none;";
    const ground = spacing(windowClass.ground);
    return `@media ${windowClass.media} {
${scope} { ${GROUND}: ${ground}; ${GROUND_BLOCK}: ${ground}; ${GROUND_INLINE}: ${ground}; }
${mount} { padding: ${spacing(windowClass.reveal)};${fill} }
${sheet} { padding: ${spacing(windowClass.padding)}; }
}
@media ${windowClass.media} and (orientation: portrait) {
${scope} { ${GROUND_BLOCK}: ${spacing(windowClass.portrait.block)}; ${GROUND_INLINE}: ${spacing(windowClass.portrait.inline)}; }
}`;
  });

  return [base, ...perClass].join("\n");
}
