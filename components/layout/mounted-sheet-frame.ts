/* What every framed section shares; a section supplies only its `MeasuredFit`, and
   mounted-sheet-frame-css.ts turns the two into that section's stylesheet.

   Plain data and arithmetic, with no React and no DOM, so plain node can import it as well as the
   app's bundler. */

/* `desktop` keeps its name from before the tier split, so every existing fit and caller stays
   valid: it is now the compact laptop tier ({breakpoints.lg}-{breakpoints.xl}, 1024-1599). `wide`
   is the new tier ({breakpoints.xl} and up, 1600+) carrying today's laptop values. */
export type WidthTier = "mobile" | "tablet" | "desktop" | "wide";

export type Orientation = "portrait" | "landscape";

export type FrameLayout = "single" | "pair";

type GroundTierName = "phone" | "tablet" | "compact" | "laptop";

/* From this content width upward, the section's content stands this tall. Content width is the
   width inside the sheet's padding. Height is a step function of width, because each line of the
   content wraps at its own width, so one regime per step. */
export interface FitRegime {
  minContentWidth: number;
  contentHeight: number;
}

/* A section's measured fit — the only per-section input to the frame.

   `section` names the section's stylesheet scope, so it must be stable and unique on the page:
   lowercase letters, digits and hyphens, starting with a letter.

   Each width tier carries its own portrait and landscape regimes, ordered by ascending
   `minContentWidth`, with `contentHeight` never rising from one to the next: a card fits when it
   clears any one regime's rectangle, which holds only while a wider column never stands taller.
   Below a tier's first regime nothing was measured, and the frame treats that as not fitting. */
export interface MeasuredFit {
  section: string;
  regimes: Readonly<
    Record<WidthTier, Readonly<Record<Orientation, readonly FitRegime[]>>>
  >;
}

/* The one seam for the orientation split. Takes a width tier's own record rather than the whole
   fit, because `tierLine` picks an orientation before any `WindowClass` exists. */
export function regimesFor(
  regimes: Readonly<Record<Orientation, readonly FitRegime[]>>,
  orientation: Orientation,
): readonly FitRegime[] {
  return regimes[orientation];
}

/* A portrait window's two bands: `block` frames the card top and bottom, `inline` is the page
   margin beside it, and one number cannot be both.

   `blockPressed` / `inlinePressed` are fields, never halved at emit time. `groundRules` builds its
   give-way body as a template-literal argument, so `spacing()` runs even where the condition is
   false — and the tablet's 172 / 2 is 86, off the spacing scale, which would throw at build time for
   every section on a code path that never renders. A tier whose half IS on the scale may still
   derive its own pair (`squareGround`); what may not happen is the emitter doing it. */
export interface PortraitGround {
  block: number;
  blockPressed: number;
  inline: number;
  inlinePressed: number;
}

export interface GroundTier {
  name: GroundTierName;
  /* The landscape ground, on both axes. Its side ground is doubled and floored by the height-cap
     centring gap, which is a window-height term no declared band could express. */
  ground: number;
  portrait: PortraitGround;
  /* Largest first. */
  paddingSteps: readonly number[];
}

export const SIDE_GROUND_MULTIPLE = 2;
/* Declared above `GROUND_TIERS` because `squareGround` reads it while that table initialises. */
export const GROUND_HALVING = 0.5;

/* A tier whose portrait band is its landscape ground on both axes, given way by the same halving
   landscape uses. */
function squareGround(ground: number): PortraitGround {
  return {
    block: ground,
    blockPressed: ground * GROUND_HALVING,
    inline: ground,
    inlinePressed: ground * GROUND_HALVING,
  };
}

/* `{spacing.*}` steps held as numbers, like the reveal ladder and the caps below, because a media
   query cannot read a custom property. A spacing token change must change them here and in the
   pixel-keyed spacing map in mounted-sheet-frame-css.ts. */
const GROUND_TIERS: Readonly<Record<GroundTierName, GroundTier>> = {
  phone: {
    name: "phone",
    ground: 16,
    portrait: { block: 96, blockPressed: 48, inline: 24, inlinePressed: 16 },
    paddingSteps: [32, 24, 16],
  },
  tablet: {
    name: "tablet",
    ground: 48,
    portrait: { block: 172, blockPressed: 96, inline: 128, inlinePressed: 64 },
    paddingSteps: [64, 48, 32],
  },
  /* Compact and laptop take a square band DERIVED from their landscape ground, never a literal:
     DESIGN.md gives their band as "Its `Ground, landscape`" and says it follows that ground wherever
     it moves, which a copied number would silently stop doing. Halving is safe on these two alone —
     both halves are on the spacing scale, where the tablet's 172 / 2 = 86 is not. */
  compact: {
    name: "compact",
    ground: 64,
    portrait: squareGround(64),
    paddingSteps: [64, 48, 32, 24],
  },
  laptop: {
    name: "laptop",
    ground: 96,
    portrait: squareGround(96),
    paddingSteps: [96, 64, 48, 32],
  },
};

/* `{breakpoints.md}`, `{breakpoints.lg}` and `{breakpoints.xl}`. The media queries use rem, as the
   type's breakpoint variants do, so ground and type change at the same width; the arithmetic needs
   pixels, which agree at the default 16px root. Held as numbers because a media query cannot read
   a custom property — change `--breakpoint-*` in app/styles/tokens.css and these together. */
const DEFAULT_ROOT_FONT_SIZE = 16;
export const BREAKPOINT_REM = { md: 48, lg: 64, xl: 100 } as const;

function breakpointPx(rem: number): number {
  return rem * DEFAULT_ROOT_FONT_SIZE;
}

/* A layout value, not a breakpoint: DESIGN.md → Foundations → Layout → `mounted-sheet`. */
const PAIR_TIER_LINE_WIDTH_REM = 80;

/* The reveal ladder: `{reveal.md}` below `{breakpoints.xl}`, `{reveal.lg}` from it. */
const REVEAL: Readonly<Record<WidthTier, number>> = {
  mobile: 12,
  tablet: 12,
  desktop: 12,
  wide: 16,
};

/* `--container-content` / `--card-height-cap` (mobile, tablet and wide) and their `-compact`
   siblings (desktop, the compact laptop tier). The stylesheet reads the tokens themselves; every
   threshold derived from a cap needs it as a number, because a media query cannot read a custom
   property. Change the tokens and this together. */
export const CAPS: Readonly<
  Record<WidthTier, { width: number; height: number }>
> = {
  mobile: { width: 1200, height: 720 },
  tablet: { width: 1200, height: 720 },
  desktop: { width: 960, height: 576 },
  wide: { width: 1200, height: 720 },
};

/* `(hover: none)` is not added: it could only drop devices whose primary input is still coarse. */
const TOUCHSCREEN_QUERY = "(pointer: coarse)";

export interface WindowClass {
  /* The complete media condition: width, height and primary pointer where they apply. */
  media: string;
  widthTier: WidthTier;
  groundTier: GroundTier;
  /* Both orientations' regimes for this class's width tier — never just the one a class happens to
     render, since a class above its tier line covers both. */
  regimes: Readonly<Record<Orientation, readonly FitRegime[]>>;
  /* A class below a tier line has no portrait windows, because every tier line sits below the
     narrowest width it applies to — `tierLine` refuses one that does not. A pair's laptop-width
     classes under `PAIR_TIER_LINE_WIDTH_REM` are split by orientation instead, so each has one. */
  portraitPossible: boolean;
  landscapePossible: boolean;
}

export interface CardRectangle {
  minCardWidth: number;
  minCardHeight: number;
}

export function formatPx(value: number): string {
  return `${Number(value.toFixed(6))}px`;
}

export function smallestPadding(groundTier: GroundTier): number {
  return groundTier.paddingSteps[groundTier.paddingSteps.length - 1];
}

/* The one statement of the phone-drop rule; `mountShows` and `tallWindowClasses` both call it, so a
   future change to the rule cannot update one and miss the other. */
function groundTierShowsMount(
  groundTierName: GroundTierName,
  hero: boolean,
): boolean {
  return hero || groundTierName !== "phone";
}

export function mountShows(windowClass: WindowClass, hero: boolean): boolean {
  return groundTierShowsMount(windowClass.groundTier.name, hero);
}

export function revealFor(windowClass: WindowClass, hero: boolean): number {
  return mountShows(windowClass, hero) ? REVEAL[windowClass.widthTier] : 0;
}

export function pairsSideBySide(
  layout: FrameLayout,
  windowClass: WindowClass,
  landscape: boolean,
): boolean {
  return (
    layout === "pair" &&
    landscape &&
    windowClass.landscapePossible &&
    (windowClass.widthTier === "desktop" || windowClass.widthTier === "wide")
  );
}

export function cardReveal(
  windowClass: WindowClass,
  hero: boolean,
  layout: FrameLayout,
  landscape: boolean,
): number {
  if (layout === "single") return revealFor(windowClass, hero);
  return pairsSideBySide(layout, windowClass, landscape)
    ? REVEAL[windowClass.widthTier]
    : 0;
}

/* The smallest card that holds the content at one padding: one rectangle per regime, because a
   wider card buys a shorter stack. A card fits when it clears any one of them.

   Side by side, two sheets share the card, so the width counts two sheets and four reveals. */
export function fitRectangles(
  regimes: readonly FitRegime[],
  reveal: number,
  padding: number,
  sideBySide = false,
): CardRectangle[] {
  return regimes.map((regime) => {
    const sheetWidth = regime.minContentWidth + 2 * padding;
    return {
      minCardWidth: sideBySide
        ? 2 * sheetWidth + 4 * reveal
        : sheetWidth + 2 * reveal,
      minCardHeight: regime.contentHeight + 2 * padding + 2 * reveal,
    };
  });
}

/* The height from which the larger ground tier fits the section's content at halved ground and
   that tier's smallest padding, worked out at the narrowest window the class covers — a wider
   window only widens the card.

   Such a window is landscape, and its height is at most the height cap plus the halved ground top
   and bottom, so its side ground is exactly double the halved ground. */
function tierLine(
  fit: MeasuredFit,
  widthTier: WidthTier,
  groundTier: GroundTier,
  narrowestWindow: number,
  layout: FrameLayout,
): number {
  const halved = groundTier.ground * GROUND_HALVING;
  const padding = smallestPadding(groundTier);
  /* A tier line only decides landscape windows, so it reads the landscape regimes. A single card
     always shows the mount at the larger tier; a pair sits side by side only at the desktop and
     wide width tiers, so its tablet and mobile lines use the stacked, unmounted arithmetic. */
  const sideBySide =
    layout === "pair" && (widthTier === "desktop" || widthTier === "wide");
  const reveal = layout === "pair" && !sideBySide ? 0 : REVEAL[widthTier];
  const heights = fitRectangles(
    regimesFor(fit.regimes[widthTier], "landscape"),
    reveal,
    padding,
    sideBySide,
  )
    .filter(
      (rectangle) =>
        rectangle.minCardHeight <= CAPS[widthTier].height &&
        rectangle.minCardWidth + 2 * SIDE_GROUND_MULTIPLE * halved <=
          narrowestWindow,
    )
    .map((rectangle) => rectangle.minCardHeight + 2 * halved);

  if (heights.length === 0) {
    throw new Error(
      `mounted-sheet-frame: section "${fit.section}" cannot be framed. No window height lets the ${groundTier.name} ground tier fit its ${widthTier} content at halved ground (${formatPx(halved)}) and the smallest padding (${formatPx(padding)}) in a ${formatPx(narrowestWindow)}-wide window, so there is no tier line. Re-measure the section, or change its content.`,
    );
  }

  const line = Math.min(...heights);
  if (!(line < narrowestWindow)) {
    throw new Error(
      `mounted-sheet-frame: section "${fit.section}" cannot be framed. Its ${groundTier.name} ground tier line for ${widthTier} type is ${formatPx(line)}, which is not below the ${formatPx(narrowestWindow)} narrowest window it applies to, so a window under the line could be portrait. Re-measure the section, or change its content.`,
    );
  }
  return line;
}

const SECTION_NAME = /^[a-z][a-z0-9-]*$/;
const FIT_KEYS: readonly string[] = ["section", "regimes"];
const REGIME_KEYS = ["minContentWidth", "contentHeight"] as const;
const WIDTH_TIERS: readonly WidthTier[] = [
  "mobile",
  "tablet",
  "desktop",
  "wide",
];
const ORIENTATIONS: readonly Orientation[] = ["portrait", "landscape"];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") return String(value);
  return typeof value;
}

/* A fit arrives as data, so its shape is checked here rather than trusted to the type. Equal
   heights in consecutive regimes pass: only a rise breaks the fits-any-rectangle rule. */
function assertValidFit(fit: MeasuredFit): void {
  if (!isPlainObject(fit)) {
    throw new Error(
      `mounted-sheet-frame: a measured fit must be an object carrying section and regimes; got ${describe(fit)}.`,
    );
  }
  const record: Record<string, unknown> = fit;
  const label = `section "${String(record.section)}"`;
  for (const key of Object.keys(record)) {
    if (!FIT_KEYS.includes(key)) {
      throw new Error(
        `mounted-sheet-frame: ${label} has an unknown key "${key}". A measured fit carries only section and regimes.`,
      );
    }
  }
  if (
    typeof record.section !== "string" ||
    !SECTION_NAME.test(record.section)
  ) {
    throw new Error(
      `mounted-sheet-frame: section name "${String(record.section)}" must be lowercase letters, digits and hyphens, starting with a letter, because it becomes a class name.`,
    );
  }
  const byTier = record.regimes;
  if (!isPlainObject(byTier)) {
    throw new Error(
      `mounted-sheet-frame: ${label} has no regimes. A measured fit needs a portrait and a landscape set for mobile, tablet, desktop and wide type.`,
    );
  }
  for (const key of Object.keys(byTier)) {
    if (!(WIDTH_TIERS as readonly string[]).includes(key)) {
      throw new Error(
        `mounted-sheet-frame: ${label} has an unknown width tier "${key}". The width tiers are mobile, tablet, desktop and wide.`,
      );
    }
  }
  for (const widthTier of WIDTH_TIERS) {
    const byOrientation: unknown = byTier[widthTier];
    if (!isPlainObject(byOrientation)) {
      throw new Error(
        `mounted-sheet-frame: ${label} has no ${widthTier} regimes. Every width tier needs a portrait and a landscape set.`,
      );
    }
    for (const key of Object.keys(byOrientation)) {
      if (!(ORIENTATIONS as readonly string[]).includes(key)) {
        throw new Error(
          `mounted-sheet-frame: ${label} has an unknown orientation "${key}" under ${widthTier}. The orientations are portrait and landscape.`,
        );
      }
    }
    for (const orientation of ORIENTATIONS) {
      const regimes: unknown = byOrientation[orientation];
      const orientationLabel = `${label}, ${widthTier} ${orientation}`;
      if (!Array.isArray(regimes)) {
        throw new Error(
          `mounted-sheet-frame: ${orientationLabel} has no regimes. Every width tier needs its measured fit for both orientations.`,
        );
      }
      if (regimes.length === 0) {
        throw new Error(
          `mounted-sheet-frame: ${orientationLabel} has no measured regimes.`,
        );
      }
      regimes.forEach((regime: unknown, index) => {
        const at = `${orientationLabel} regime ${index}`;
        if (!isPlainObject(regime)) {
          throw new Error(
            `mounted-sheet-frame: ${at} must be an object carrying minContentWidth and contentHeight; got ${describe(regime)}.`,
          );
        }
        for (const key of Object.keys(regime)) {
          if (!(REGIME_KEYS as readonly string[]).includes(key)) {
            throw new Error(
              `mounted-sheet-frame: ${at} has an unknown key "${key}". A regime carries only minContentWidth and contentHeight.`,
            );
          }
        }
        for (const field of REGIME_KEYS) {
          const value = regime[field];
          if (
            typeof value !== "number" ||
            !Number.isFinite(value) ||
            value <= 0
          ) {
            throw new Error(
              `mounted-sheet-frame: ${at} has ${field} ${describe(value)}. It must be a positive, finite number of pixels.`,
            );
          }
        }
        if (index === 0) return;
        const previous = regimes[index - 1] as FitRegime;
        const current = regime as unknown as FitRegime;
        if (!(current.minContentWidth > previous.minContentWidth)) {
          throw new Error(
            `mounted-sheet-frame: ${at} starts at ${formatPx(current.minContentWidth)}, not wider than regime ${index - 1} (${formatPx(previous.minContentWidth)}). Regime widths must strictly ascend.`,
          );
        }
        if (current.contentHeight > previous.contentHeight) {
          throw new Error(
            `mounted-sheet-frame: ${at} stands ${formatPx(current.contentHeight)} tall, taller than regime ${index - 1} (${formatPx(previous.contentHeight)}) at a narrower width. A regime's height must never rise as its width grows. Re-measure the section.`,
          );
        }
      });
    }
  }
}

interface TierLines {
  tablet: number;
  compact: number;
  compactTouchscreen: number;
  wide: number;
  wideTouchscreen: number;
}

function tierLines(fit: MeasuredFit, layout: FrameLayout): TierLines {
  assertValidFit(fit);
  const md = breakpointPx(BREAKPOINT_REM.md);
  const lg = breakpointPx(BREAKPOINT_REM.lg);
  const compactNarrowest = breakpointPx(
    layout === "pair" ? PAIR_TIER_LINE_WIDTH_REM : BREAKPOINT_REM.lg,
  );
  /* The wide tier's narrowest window is always `{breakpoints.xl}`: `PAIR_TIER_LINE_WIDTH_REM` sits
     entirely inside the compact tier (1024-1599), so it never reaches up to 1600 and a pair's wide
     tier line is worked out the same way a single card's is. */
  const wideNarrowest = breakpointPx(BREAKPOINT_REM.xl);
  const lines = {
    tablet: tierLine(fit, "tablet", GROUND_TIERS.tablet, md, layout),
    compact: tierLine(
      fit,
      "desktop",
      GROUND_TIERS.compact,
      compactNarrowest,
      layout,
    ),
    compactTouchscreen: tierLine(
      fit,
      "desktop",
      GROUND_TIERS.tablet,
      compactNarrowest,
      layout,
    ),
    wide: tierLine(fit, "wide", GROUND_TIERS.laptop, wideNarrowest, layout),
    wideTouchscreen: tierLine(
      fit,
      "wide",
      GROUND_TIERS.tablet,
      wideNarrowest,
      layout,
    ),
  };
  /* A portrait pair window from `{breakpoints.lg}` to `PAIR_TIER_LINE_WIDTH_REM` is taller than its
     1024px or more of width, so it stands above a compact tier line only while the line sits below
     `{breakpoints.lg}`. The compact cap and ground keep every line at 640px or less; this guards a
     change to the caps or ground tiers. Only the compact tier line moves for a pair — the wide line
     always sits at `{breakpoints.xl}`, so it needs no such guard. */
  if (layout === "pair") {
    for (const line of [lines.compact, lines.compactTouchscreen]) {
      if (!(line < lg)) {
        throw new Error(
          `mounted-sheet-frame: section "${fit.section}" cannot be framed. Its pair tier line ${formatPx(line)} is not below ${formatPx(lg)}, so a portrait window from ${formatPx(lg)} to ${formatPx(compactNarrowest)} wide could stand below it.`,
        );
      }
    }
  }
  return lines;
}

/* Every window falls in exactly one class: four width tiers, split by height at each tier line,
   and at `{breakpoints.lg}` and wider split by primary pointer as well. A pair's compact-width
   windows under `PAIR_TIER_LINE_WIDTH_REM` are split by orientation instead of height: landscape
   ones sit side by side at the phone ground tier, and portrait ones stack at the ground a single
   card takes there, which needs no height test because `tierLines` keeps every pair line below
   `{breakpoints.lg}`. Each pointer gains two classes, and its tier line applies only from
   `PAIR_TIER_LINE_WIDTH_REM` up. `PAIR_TIER_LINE_WIDTH_REM` sits inside the compact tier alone, so
   the wide tier never gets that narrow-band split. */
export function windowClasses(
  fit: MeasuredFit,
  layout: FrameLayout = "single",
): WindowClass[] {
  const lines = tierLines(fit, layout);
  const md = `${BREAKPOINT_REM.md}rem`;
  const lg = `${BREAKPOINT_REM.lg}rem`;
  const xl = `${BREAKPOINT_REM.xl}rem`;
  const pairLine = `${PAIR_TIER_LINE_WIDTH_REM}rem`;
  const tabletWidth = `(${md} <= width < ${lg})`;
  const compactWidth =
    layout === "pair"
      ? `(${pairLine} <= width < ${xl})`
      : `(${lg} <= width < ${xl})`;
  const wideWidth = `(width >= ${xl})`;
  const pointer = `(not ${TOUCHSCREEN_QUERY})`;
  const atOrAbove = (line: number) => `(height >= ${formatPx(line)})`;
  const below = (line: number) => `(height < ${formatPx(line)})`;

  /* One width tier's classes, from its own width query and tier line. `narrowBand` supplies the
     pair's orientation-split classes under `PAIR_TIER_LINE_WIDTH_REM`, and is passed only for the
     compact tier — the wide tier has no such band. */
  const widthTierClasses = (
    widthTier: "desktop" | "wide",
    widthQuery: string,
    pointerQuery: string,
    aboveTier: GroundTier,
    line: number,
    narrowBand?: string,
  ): WindowClass[] => [
    ...(layout === "pair" && narrowBand !== undefined
      ? [
          {
            media: `${narrowBand} and (orientation: landscape) and ${pointerQuery}`,
            widthTier,
            groundTier: GROUND_TIERS.phone,
            regimes: fit.regimes[widthTier],
            portraitPossible: false,
            landscapePossible: true,
          },
          {
            media: `${narrowBand} and (orientation: portrait) and ${pointerQuery}`,
            widthTier,
            groundTier: aboveTier,
            regimes: fit.regimes[widthTier],
            portraitPossible: true,
            landscapePossible: false,
          },
        ]
      : []),
    {
      media: `${widthQuery} and ${pointerQuery} and ${atOrAbove(line)}`,
      widthTier,
      groundTier: aboveTier,
      regimes: fit.regimes[widthTier],
      portraitPossible: true,
      landscapePossible: true,
    },
    {
      media: `${widthQuery} and ${pointerQuery} and ${below(line)}`,
      widthTier,
      groundTier: GROUND_TIERS.phone,
      regimes: fit.regimes[widthTier],
      portraitPossible: false,
      landscapePossible: true,
    },
  ];

  const compactNarrowBand = `(${lg} <= width < ${pairLine})`;

  return [
    {
      media: `(width < ${md})`,
      widthTier: "mobile",
      groundTier: GROUND_TIERS.phone,
      regimes: fit.regimes.mobile,
      portraitPossible: true,
      landscapePossible: true,
    },
    {
      media: `${tabletWidth} and ${atOrAbove(lines.tablet)}`,
      widthTier: "tablet",
      groundTier: GROUND_TIERS.tablet,
      regimes: fit.regimes.tablet,
      portraitPossible: true,
      landscapePossible: true,
    },
    {
      media: `${tabletWidth} and ${below(lines.tablet)}`,
      widthTier: "tablet",
      groundTier: GROUND_TIERS.phone,
      regimes: fit.regimes.tablet,
      portraitPossible: false,
      landscapePossible: true,
    },
    ...widthTierClasses(
      "desktop",
      compactWidth,
      pointer,
      GROUND_TIERS.compact,
      lines.compact,
      compactNarrowBand,
    ),
    ...widthTierClasses(
      "desktop",
      compactWidth,
      TOUCHSCREEN_QUERY,
      GROUND_TIERS.tablet,
      lines.compactTouchscreen,
      compactNarrowBand,
    ),
    ...widthTierClasses(
      "wide",
      wideWidth,
      pointer,
      GROUND_TIERS.laptop,
      lines.wide,
    ),
    ...widthTierClasses(
      "wide",
      wideWidth,
      TOUCHSCREEN_QUERY,
      GROUND_TIERS.tablet,
      lines.wideTouchscreen,
    ),
  ];
}

/* A tall section's window classes: width and primary pointer only.

   A tall card is taller than every window, so there is no tier line to split it by height and no
   give-way to apply — it never has to give up padding for room the way a fitted card does at a
   pressed window, so it can afford one step more than a fitted card's largest step. At the fitted
   value itself, a card that scrolls reads as too tight. The touchscreen split stays, because a
   touchscreen's ground tier is a property of the device, not of the content. */
export interface TallWindowClass {
  media: string;
  widthTier: WidthTier;
  ground: number;
  /* Tall mode has no give-way, so the pressed pair is not part of a tall class. */
  portrait: Pick<PortraitGround, "block" | "inline">;
  padding: number;
  reveal: number;
  mountShows: boolean;
}

/* One step above each ground tier's own largest (`paddingSteps[0]`), read off the spacing scale:
   phone 32 → 48, tablet and compact 64 → 96, laptop 96 → 128 (owner, 2026-09-18). */
const TALL_PADDING: Readonly<Record<GroundTierName, number>> = {
  phone: 48,
  tablet: 96,
  compact: 96,
  laptop: 128,
};

export function tallWindowClasses(hero: boolean): TallWindowClass[] {
  const md = `${BREAKPOINT_REM.md}rem`;
  const lg = `${BREAKPOINT_REM.lg}rem`;
  const xl = `${BREAKPOINT_REM.xl}rem`;
  const pointer = `(not ${TOUCHSCREEN_QUERY})`;

  const build = (
    media: string,
    widthTier: WidthTier,
    groundTier: GroundTier,
  ): TallWindowClass => {
    const shows = groundTierShowsMount(groundTier.name, hero);
    return {
      media,
      widthTier,
      ground: groundTier.ground,
      portrait: groundTier.portrait,
      padding: TALL_PADDING[groundTier.name],
      reveal: shows ? REVEAL[widthTier] : 0,
      mountShows: shows,
    };
  };

  return [
    build(`(width < ${md})`, "mobile", GROUND_TIERS.phone),
    build(`(${md} <= width < ${lg})`, "tablet", GROUND_TIERS.tablet),
    build(
      `(${lg} <= width < ${xl}) and ${pointer}`,
      "desktop",
      GROUND_TIERS.compact,
    ),
    build(
      `(${lg} <= width < ${xl}) and ${TOUCHSCREEN_QUERY}`,
      "desktop",
      GROUND_TIERS.tablet,
    ),
    build(`(width >= ${xl}) and ${pointer}`, "wide", GROUND_TIERS.laptop),
    build(
      `(width >= ${xl}) and ${TOUCHSCREEN_QUERY}`,
      "wide",
      GROUND_TIERS.tablet,
    ),
  ];
}
