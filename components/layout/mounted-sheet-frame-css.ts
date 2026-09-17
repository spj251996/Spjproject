/* Extension-qualified, unlike the rest of components/: plain node resolves a relative import only
   with its extension, and this module stays importable outside the app's bundler. */
import {
  CARD_HEIGHT_CAP,
  CARD_WIDTH_CAP,
  type CardRectangle,
  cardReveal,
  type FitRegime,
  type FrameLayout,
  fitRectangles,
  formatPx,
  GROUND_HALVING,
  heroReveal,
  type MeasuredFit,
  mountShows,
  type Orientation,
  pairsSideBySide,
  regimesFor,
  revealFor,
  SIDE_GROUND_MULTIPLE,
  smallestPadding,
  type WindowClass,
  windowClasses,
} from "./mounted-sheet-frame.ts";

/* DESIGN.md → Foundations → Layout → `mounted-sheet` → The frame · When space runs out.

   One section's frame as a static stylesheet, generated from its measured fit so that no threshold
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

/* The card's minimum height from the window: every viewport-height term is `svh`, so nothing in the
   frame moves as a phone's toolbar hides. A landscape card's is also capped. */
const CARD_HEIGHT = `calc(100svh - 2 * ${GROUND_VALUE})`;
const CAPPED_CARD_HEIGHT = `min(var(--card-height-cap), ${CARD_HEIGHT})`;

/* Foundations → Spacing. Every ground, halved ground, reveal and padding the frame emits must be a
   step on the scale; one that is not fails generation instead of shipping. Keyed by each step's
   pixel value, because the arithmetic that picks a step needs the number a media query cannot read
   from the token, so a spacing token change must change this map too. */
const SPACING_TOKEN: Readonly<Record<number, string>> = {
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
   spans the full window width, which a classic scrollbar narrows — DESIGN.md → Iteration Notes →
   Known Gaps.

   A portrait card is the window less the ground on every side. A landscape card is
   min(width cap, window width − 2 × max(double the ground, (window height − height cap) / 2)) wide
   and min(height cap, window height − 2 × ground) tall. Up to height cap + 4 × ground the centring
   term never exceeds double the ground, so the ground term alone decides the width, and a media
   query can state it. Above that band the centring term decides, and that needs window width minus
   window height, which CSS cannot state. A rectangle no wider than the height cap still clears
   there, because a landscape window is at least as wide as it is tall. A wider one is counted only
   inside the band (DESIGN.md → Measured per section): conservative, since a window above the band
   may keep full ground where halving would have fitted, and nothing is hidden, because the padding
   chain reads the card's real width. */
function windowFits(
  windowClass: WindowClass,
  hero: boolean,
  layout: FrameLayout,
  ground: number,
  landscape: boolean,
): Condition {
  const rectangles = fitRectangles(
    regimesFor(windowClass.regimes, orientationName(landscape)),
    cardReveal(windowClass, hero, layout, landscape),
    smallestPadding(windowClass.groundTier),
    pairsSideBySide(layout, windowClass, landscape),
  );
  if (!landscape) return clears(rectangles, 2 * ground, 2 * ground);

  const band = `(height <= ${formatPx(CARD_HEIGHT_CAP + 2 * SIDE_GROUND_MULTIPLE * ground)})`;
  return any(
    ...rectangles
      .filter(
        (rectangle) =>
          rectangle.minCardWidth <= CARD_WIDTH_CAP &&
          rectangle.minCardHeight <= CARD_HEIGHT_CAP,
      )
      .map((rectangle) =>
        all(
          `(width >= ${formatPx(rectangle.minCardWidth + 2 * SIDE_GROUND_MULTIPLE * ground)})`,
          `(height >= ${formatPx(rectangle.minCardHeight + 2 * ground)})`,
          rectangle.minCardWidth > CARD_HEIGHT_CAP ? band : true,
        ),
      ),
  );
}

/* Full ground wins. The ground halves only where the full-ground card does not fit and the halved
   one does; a window where neither fits keeps full ground and the page scrolls. */
function halvingCondition(
  windowClass: WindowClass,
  hero: boolean,
  layout: FrameLayout,
  landscape: boolean,
): Condition {
  const ground = windowClass.groundTier.ground;
  return all(
    not(windowFits(windowClass, hero, layout, ground, landscape)),
    windowFits(windowClass, hero, layout, ground * GROUND_HALVING, landscape),
  );
}

function orientationsOf(windowClass: WindowClass): boolean[] {
  const orientations: boolean[] = [];
  if (windowClass.portraitPossible) orientations.push(false);
  if (windowClass.landscapePossible) orientations.push(true);
  return orientations;
}

function groundRules(
  windowClass: WindowClass,
  hero: boolean,
  layout: FrameLayout,
  scope: string,
): string {
  const ground = windowClass.groundTier.ground;
  const rules = [
    `@media ${windowClass.media} {\n${scope} { ${GROUND}: ${spacing(ground)}; }\n}`,
  ];
  for (const landscape of orientationsOf(windowClass)) {
    rules.push(
      mediaRule(
        `@media ${windowClass.media} and ${orientationQuery(landscape)}`,
        halvingCondition(windowClass, hero, layout, landscape),
        `${scope} { ${GROUND}: ${spacing(ground * GROUND_HALVING)}; }`,
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

/* DESIGN.md → Foundations → Layout → `mounted-pair`. Each window class and orientation takes
   exactly one of two blocks, so neither has to undo the other.

   Side by side, the shared mount is the card: it takes the reveal, lays the leaves in a row twice
   the reveal apart, and shows its crease; each leaf is only a column holding its sheet. Each sheet
   aligns its content to the top rather than centring it: the two sheets share one height, so
   centred content of different heights would set their headings at different heights across the
   fold. Stacked sheets and single cards stay centred.

   Stacked, the shared mount stops being a surface, loses its fill, grain and shadow, and spaces
   its leaves by the ground below one card plus the ground above the next. Each leaf carries no
   mount at any width — zero reveal, no fill, no grain — because a stacked sheet is its own card
   with the ground itself as its only frame. It keeps `shadow-mount`'s shadow, since this rule never
   strips `box-shadow`, so the sheet still lifts off the ground. Each leaf takes a card's minimum
   height, so each stacked card fills its own screen. */
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
${mount} { gap: calc(2 * ${GROUND_VALUE}); padding: ${spacing(0)}; ${strip} box-shadow: none; }
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
   orientation's own regimes — a portrait and a landscape window at the same width and height can
   need different padding, since their content differs. A class with no portrait windows
   (`!windowClass.portraitPossible`) gets no portrait chain at all, which is what used to need an
   explicit "portrait-only rectangle" exception when one chain covered both orientations at once.
   Where the ground halves, a second chain under the halving condition resets to the smallest step
   and climbs again against the halved card.

   A pair's stacked orientations may borrow another section's padding fit (`stackedPadding`) so a
   stacked card reads like that section's own — Event Info's stacked cards read like the
   invite's (DESIGN.md → `mounted-pair`). Only the chain's own regimes and reveal come from it: the ground, the halving
   condition, the padding steps and the landscape cap skip all stay the window's own, because the
   card the window gives the sheet is unchanged — only the content it is judged to hold moves to
   the borrowed fit. Side-by-side orientations never borrow; they always read the section's own
   regimes and `cardReveal`. */
function paddingRules(
  windowClass: WindowClass,
  hero: boolean,
  layout: FrameLayout,
  scope: string,
  stackedPadding?: MeasuredFit,
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
    ground: number,
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
        if (landscape && rectangle.minCardHeight > CARD_HEIGHT_CAP) continue;
        rules.push(
          `@media (height >= ${formatPx(rectangle.minCardHeight + 2 * ground)}) {\n@container (width >= ${formatPx(rectangle.minCardWidth)}) {\n${sheet} { padding: ${spacing(padding)}; }\n}\n}`,
        );
      }
    }
    return `${prelude} {\n${rules.join("\n")}\n}`;
  };

  const ground = windowClass.groundTier.ground;
  const rules: string[] = [];
  for (const landscape of orientationsOf(windowClass)) {
    const sideBySide = pairsSideBySide(layout, windowClass, landscape);
    const stacked =
      layout === "pair" && !sideBySide && stackedPadding !== undefined;
    const regimes = stacked
      ? regimesFor(
          stackedPadding.regimes[windowClass.widthTier],
          orientationName(landscape),
        )
      : regimesFor(windowClass.regimes, orientationName(landscape));
    const reveal = stacked
      ? heroReveal(windowClass)
      : cardReveal(windowClass, hero, layout, landscape);
    const base = `@media ${windowClass.media} and ${orientationQuery(landscape)}`;
    rules.push(chain(base, ground, landscape, regimes, sideBySide, reveal));

    const halving = halvingCondition(windowClass, hero, layout, landscape);
    if (halving === false) continue;
    const prelude = halving === true ? base : `${base} and ${halving}`;
    rules.push(
      chain(
        prelude,
        ground * GROUND_HALVING,
        landscape,
        regimes,
        sideBySide,
        reveal,
      ),
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
     the sheet grow inside it as flex items, so each fills the height above it. */
  return `${scope} {
  display: flex;
  flex-direction: column;
  min-height: 100svh;
  padding-block: ${GROUND_VALUE};
  padding-inline: ${GROUND_VALUE};
  ${safeCentre}
}
@media (orientation: landscape) {
${scope} { padding-inline: max(calc(${SIDE_GROUND_MULTIPLE} * ${GROUND_VALUE}), calc((100svh - var(--card-height-cap)) / 2)); }
}
${box} {
  container-type: inline-size;
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
   tier line, a tier line not below its narrowest window, a value off the spacing scale, a pair
   asked to be the hero, a single card given a stacked padding fit, or a stacked padding fit that
   is itself malformed. */
export function mountedSheetFrameCss(
  fit: MeasuredFit,
  hero: boolean,
  layout: FrameLayout = "single",
  stackedPadding?: MeasuredFit,
): string {
  /* Validates the fit, so it runs before anything reads the fit's section name — including the
     hero-pair guard below, which needs a valid fit to report one. */
  const classes = windowClasses(fit, layout);
  if (layout === "pair" && hero) {
    throw new Error(
      `mounted-sheet-frame-css: section "${fit.section}" asks for a hero pair, but a pair is never the hero — the opening section is a single card.`,
    );
  }
  if (stackedPadding !== undefined) {
    if (layout !== "pair") {
      throw new Error(
        `mounted-sheet-frame-css: section "${fit.section}" was given a stacked padding fit, but a stacked padding fit is only for a pair — a single card has no stacked sheets to borrow padding for.`,
      );
    }
    /* Validated the same way as the section's own fit, so a malformed stacked padding fit fails
       with the same named error rather than a confusing one from reading its regimes later. */
    windowClasses(stackedPadding);
  }
  const scope = `.${frameScopeClass(fit)}`;
  return [
    frameRules(scope, layout),
    ...classes.flatMap((windowClass) => [
      groundRules(windowClass, hero, layout, scope),
      layout === "pair"
        ? pairLayoutRules(windowClass, scope)
        : mountRules(windowClass, hero, scope),
      paddingRules(windowClass, hero, layout, scope, stackedPadding),
    ]),
  ].join("\n");
}
