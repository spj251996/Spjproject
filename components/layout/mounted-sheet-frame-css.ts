/* Extension-qualified, unlike the rest of components/, so node can run this module directly. */
import {
  CARD_HEIGHT_CAP,
  CARD_WIDTH_CAP,
  type CardRectangle,
  fitRectangles,
  formatPx,
  GROUND_HALVING,
  type MeasuredFit,
  mountShows,
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

   Split by mechanism:
   - The ground is a media query per window class. It needs the window rather than the card,
     because it asks whether a card that is not on screen — the full-ground one — would hold the
     content.
   - The padding is a container query on the card's box, keyed to the card's own size.

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

/* Foundations → Spacing. Every ground, halved ground, reveal and padding the frame emits must be a
   step on the scale; one that is not fails generation instead of shipping. */
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

function containerRule(condition: Condition, body: string): string {
  if (condition === false) return "";
  return condition === true ? body : `@container ${condition} {\n${body}\n}`;
}

/* Does this window's card, at the given ground, hold the content at the smallest padding? Stated in
   window terms, so it can decide the ground for a card that is not on screen.

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
    windowClass.regimes,
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
function groundRules(
  section: string,
  windowClass: WindowClass,
  hero: boolean,
  scope: string,
): string {
  const ground = windowClass.groundTier.ground;
  const halved = ground * GROUND_HALVING;
  const rules = [
    `@media ${windowClass.media} {\n${scope} { ${GROUND}: ${spacing(ground)}; }\n}`,
  ];
  const orientations = windowClass.portraitPossible ? [false, true] : [true];
  for (const landscape of orientations) {
    rules.push(
      mediaRule(
        `@media ${windowClass.media} and (orientation: ${landscape ? "landscape" : "portrait"})`,
        all(
          not(windowFits(section, windowClass, hero, ground, landscape)),
          windowFits(section, windowClass, hero, halved, landscape),
        ),
        `${scope} { ${GROUND}: ${spacing(halved)}; }`,
      ),
    );
  }
  return rules.filter(Boolean).join("\n");
}

/* The mount's reveal comes from the same number the fit arithmetic used, so the two cannot drift.
   Where the mount does not show it loses its fill and its grain, and keeps `shadow-mount`. */
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

/* The padding steps down while the card does not clear the previous step. Later rules win, so the
   largest padding that fits applies — which is also how padding climbs back once the ground halves. */
function paddingRules(
  windowClass: WindowClass,
  hero: boolean,
  scope: string,
): string {
  const { paddingSteps } = windowClass.groundTier;
  const reveal = revealFor(windowClass, hero);
  const sheet = `${scope} > .${FRAME_CLASS.box} > .${FRAME_CLASS.mount} > .${FRAME_CLASS.sheet}`;
  const rules = [`${sheet} { padding: ${spacing(paddingSteps[0])}; }`];
  for (let step = 1; step < paddingSteps.length; step++) {
    rules.push(
      containerRule(
        not(
          clears(
            fitRectangles(windowClass.regimes, reveal, paddingSteps[step - 1]),
            0,
            0,
          ),
        ),
        `${sheet} { padding: ${spacing(paddingSteps[step])}; }`,
      ),
    );
  }
  return `@media ${windowClass.media} {\n${rules.filter(Boolean).join("\n")}\n}`;
}

function frameRules(scope: string): string {
  const box = `${scope} > .${FRAME_CLASS.box}`;
  const mount = `${box} > .${FRAME_CLASS.mount}`;
  const sheet = `${mount} > .${FRAME_CLASS.sheet}`;
  const ground = `var(${GROUND})`;
  const cardHeight = `calc(100svh - 2 * ${ground})`;

  /* Plain `center` first is the fallback for an engine that drops the `safe` declaration. `safe`
     keeps content that outgrows its box on the side the page can scroll to. */
  const safeCentre = `justify-content: center;
  justify-content: safe center;
  align-items: center;
  align-items: safe center;`;

  /* Every viewport-height term is `svh`, so nothing in the frame moves as a phone's toolbar hides.

     The mount's `::after` reaches past the box only when the content has grown the card beyond it,
     and keeps the ground below the card inside the scrollable area then. 1px wide because a
     zero-width box adds no scrollable overflow in Chromium. It carries no content, so the mount
     still carries no text. */
  return `${scope} {
  display: flex;
  flex-direction: column;
  min-height: 100svh;
  padding-block: ${ground};
  padding-inline: ${ground};
  ${safeCentre}
}
@media (orientation: landscape) {
${scope} { padding-inline: max(calc(${SIDE_GROUND_MULTIPLE} * ${ground}), calc((100svh - var(--card-height-cap)) / 2)); }
}
${box} {
  container-type: size;
  flex: none;
  width: 100%;
  height: ${cardHeight};
}
@media (orientation: landscape) {
${box} {
  width: min(var(--container-content), 100%);
  height: min(var(--card-height-cap), ${cardHeight});
}
}
${mount} {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 100%;
}
${mount}::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 0;
  width: 1px;
  height: ${ground};
  pointer-events: none;
}
${sheet} {
  flex: 1 0 auto;
  display: flex;
  flex-direction: column;
  ${safeCentre}
}`;
}

/* Throws, failing the build, when the section cannot be framed as specified: an invalid fit, no tier
   line, a tier line not below its narrowest window, a card rectangle wider than the height cap, or a
   value off the spacing scale. */
export function mountedSheetFrameCss(fit: MeasuredFit, hero: boolean): string {
  const scope = `.${frameScopeClass(fit)}`;
  const classes = windowClasses(fit);
  return [
    frameRules(scope),
    ...classes.flatMap((windowClass) => [
      groundRules(fit.section, windowClass, hero, scope),
      mountRules(windowClass, hero, scope),
      paddingRules(windowClass, hero, scope),
    ]),
  ].join("\n");
}
