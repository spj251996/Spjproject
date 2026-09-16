/* Extension-qualified, unlike the rest of components/: plain node resolves a relative import only
   with its extension, and this module stays importable outside the app's bundler. */
import {
  CARD_HEIGHT_CAP,
  CARD_WIDTH_CAP,
  type CardRectangle,
  type FitRegime,
  fitRectangles,
  formatPx,
  GROUND_HALVING,
  type MeasuredFit,
  mountShows,
  type Orientation,
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
   and min(height cap, window height − 2 × ground) tall. The centring term only exceeds double the
   ground once the window is taller than the height cap, and a landscape window is wider still, so a
   rectangle no wider than the height cap is decided by the ground term alone — which a media query
   can state and a width-minus-height term cannot. */
function windowFits(
  section: string,
  windowClass: WindowClass,
  hero: boolean,
  ground: number,
  landscape: boolean,
): Condition {
  const rectangles = fitRectangles(
    regimesFor(windowClass.regimes, orientationName(landscape)),
    revealFor(windowClass, hero),
    smallestPadding(windowClass.groundTier),
  );
  if (!landscape) return clears(rectangles, 2 * ground, 2 * ground);

  const reachable = rectangles.filter(
    (rectangle) =>
      rectangle.minCardWidth <= CARD_WIDTH_CAP &&
      rectangle.minCardHeight <= CARD_HEIGHT_CAP,
  );
  const tooWide = reachable.find(
    (rectangle) => rectangle.minCardWidth > CARD_HEIGHT_CAP,
  );
  if (tooWide !== undefined) {
    throw new Error(
      `mounted-sheet-frame-css: section "${section}" cannot be framed. A ${windowClass.widthTier} card rectangle is ${formatPx(tooWide.minCardWidth)} wide, wider than the ${formatPx(CARD_HEIGHT_CAP)} height cap. Deciding its landscape ground would need a width-minus-height media query, which CSS cannot state.`,
    );
  }
  return clears(reachable, 2 * SIDE_GROUND_MULTIPLE * ground, 2 * ground);
}

/* Full ground wins. The ground halves only where the full-ground card does not fit and the halved
   one does; a window where neither fits keeps full ground and the page scrolls. */
function halvingCondition(
  section: string,
  windowClass: WindowClass,
  hero: boolean,
  landscape: boolean,
): Condition {
  const ground = windowClass.groundTier.ground;
  return all(
    not(windowFits(section, windowClass, hero, ground, landscape)),
    windowFits(section, windowClass, hero, ground * GROUND_HALVING, landscape),
  );
}

function orientationsOf(windowClass: WindowClass): boolean[] {
  return windowClass.portraitPossible ? [false, true] : [true];
}

function groundRules(
  section: string,
  windowClass: WindowClass,
  hero: boolean,
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
        halvingCondition(section, windowClass, hero, landscape),
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
   and climbs again against the halved card. */
function paddingRules(
  section: string,
  windowClass: WindowClass,
  hero: boolean,
  scope: string,
): string {
  const sheet = `${scope} > .${FRAME_CLASS.box} > .${FRAME_CLASS.mount} > .${FRAME_CLASS.sheet}`;
  const ascending = [...windowClass.groundTier.paddingSteps].reverse();
  const reveal = revealFor(windowClass, hero);

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
  ): string => {
    const rules = [`${sheet} { padding: ${spacing(ascending[0])}; }`];
    for (const padding of ascending.slice(1)) {
      for (const rectangle of fitRectangles(regimes, reveal, padding)) {
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
    const regimes = regimesFor(windowClass.regimes, orientationName(landscape));
    const base = `@media ${windowClass.media} and ${orientationQuery(landscape)}`;
    rules.push(chain(base, ground, landscape, regimes));

    const halving = halvingCondition(section, windowClass, hero, landscape);
    if (halving === false) continue;
    const prelude = halving === true ? base : `${base} and ${halving}`;
    rules.push(chain(prelude, ground * GROUND_HALVING, landscape, regimes));
  }
  return rules.join("\n");
}

function frameRules(scope: string): string {
  const box = `${scope} > .${FRAME_CLASS.box}`;
  const mount = `${box} > .${FRAME_CLASS.mount}`;
  const sheet = `${mount} > .${FRAME_CLASS.sheet}`;

  /* Plain `center` first is the fallback for an engine that drops the `safe` declaration. `safe`
     keeps content that outgrows its box on the side the page can scroll to. */
  const safeCentre = `justify-content: center;
  justify-content: safe center;
  align-items: center;
  align-items: safe center;`;

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
}`;
}

/* Throws, failing the build, when the section cannot be framed as specified: an invalid fit, no
   tier line, a tier line not below its narrowest window, a reachable card rectangle wider than the
   height cap at the smallest padding, or a value off the spacing scale. */
export function mountedSheetFrameCss(fit: MeasuredFit, hero: boolean): string {
  /* Validates the fit, so it runs before anything reads the fit's section name. */
  const classes = windowClasses(fit);
  const scope = `.${frameScopeClass(fit)}`;
  return [
    frameRules(scope),
    ...classes.flatMap((windowClass) => [
      groundRules(fit.section, windowClass, hero, scope),
      mountRules(windowClass, hero, scope),
      paddingRules(fit.section, windowClass, hero, scope),
    ]),
  ].join("\n");
}
