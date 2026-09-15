/* DESIGN.md → Foundations → Layout → `mounted-sheet` → The frame · When space runs out · Measured
   per section.

   What every framed section shares, and nothing any section measures: the ground tiers and their
   padding steps, the card caps, the touchscreen query, the arithmetic that turns measured content
   into card rectangles, and the tier lines derived from it. A section supplies its content as a
   `MeasuredFit`; mounted-sheet-frame-css.ts turns the two into that section's stylesheet.

   Plain data and arithmetic, with no React and no DOM, so a node script — the section measuring
   script — can import it. */

/* Type follows these alone (Interaction Rules → Responsive Behavior). */
export type WidthTier = "mobile" | "tablet" | "desktop";

/* Ground and padding follow these. A window's ground tier starts from its width tier and is moved
   only by its height and its primary pointer. */
type GroundTierName = "phone" | "tablet" | "laptop";

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

   Each width tier's regimes are ordered by ascending `minContentWidth`. Below a tier's first regime
   nothing was measured, and the frame treats that as not fitting. */
export interface MeasuredFit {
  section: string;
  regimes: Readonly<Record<WidthTier, readonly FitRegime[]>>;
}

interface GroundTier {
  name: GroundTierName;
  ground: number;
  /* Largest first. */
  paddingSteps: readonly number[];
}

const GROUND_TIERS: Readonly<Record<GroundTierName, GroundTier>> = {
  phone: { name: "phone", ground: 16, paddingSteps: [32, 24, 16] },
  tablet: { name: "tablet", ground: 48, paddingSteps: [64, 48, 32] },
  laptop: { name: "laptop", ground: 96, paddingSteps: [96, 64, 48, 32] },
};

/* `{breakpoints.md}` and `{breakpoints.lg}`. The media queries use the rem form, as the type's own
   breakpoint variants do, so a window changes ground tier exactly where it changes type. The
   arithmetic needs pixels, and the two agree at the default 16px root. */
const DEFAULT_ROOT_FONT_SIZE = 16;
const BREAKPOINT_REM = { md: 48, lg: 64 } as const;

function breakpointPx(rem: number): number {
  return rem * DEFAULT_ROOT_FONT_SIZE;
}

/* The reveal ladder: `{reveal.md}` below `{breakpoints.lg}`, `{reveal.lg}` from it. */
const REVEAL: Readonly<Record<WidthTier, number>> = {
  mobile: 12,
  tablet: 12,
  desktop: 16,
};

/* `--container-content` and `--card-height-cap`. The stylesheet reads the tokens themselves; these
   numbers exist because a media query cannot read a custom property, so every threshold derived
   from a cap needs it as a number. A change to either token must change it here too. */
export const CARD_WIDTH_CAP = 1200;
export const CARD_HEIGHT_CAP = 720;

/* A landscape window's side ground is at least double the ground it currently takes. */
export const SIDE_GROUND_MULTIPLE = 2;
export const GROUND_HALVING = 0.5;

/* The primary pointer, never `any-pointer`: a touchscreen laptop's primary pointer is its trackpad,
   and it keeps laptop ground. `(hover: none)` is not added because it could only drop devices whose
   primary input is still coarse, and a missed touchscreen is the failure this query exists for. */
const TOUCHSCREEN_QUERY = "(pointer: coarse)";

export interface WindowClass {
  /* The complete media condition: width, height and primary pointer where they apply. */
  media: string;
  widthTier: WidthTier;
  groundTier: GroundTier;
  regimes: readonly FitRegime[];
  /* A class below a tier line has no portrait windows, because every tier line sits below the
     narrowest width it applies to — `tierLine` refuses one that does not. */
  portraitPossible: boolean;
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

/* Without the hero setting, the mount loses its fill and reveal wherever the window takes the phone
   ground tier. */
export function mountShows(windowClass: WindowClass, hero: boolean): boolean {
  return hero || windowClass.groundTier.name !== "phone";
}

export function revealFor(windowClass: WindowClass, hero: boolean): number {
  return mountShows(windowClass, hero) ? REVEAL[windowClass.widthTier] : 0;
}

/* The smallest card that holds the content at one padding: one rectangle per regime, because a
   wider card buys a shorter stack. A card fits when it clears any one of them. */
export function fitRectangles(
  regimes: readonly FitRegime[],
  reveal: number,
  padding: number,
): CardRectangle[] {
  const chrome = 2 * reveal + 2 * padding;
  return regimes.map((regime) => ({
    minCardWidth: regime.minContentWidth + chrome,
    minCardHeight: regime.contentHeight + chrome,
  }));
}

/* The height from which the larger ground tier fits the section's content at halved ground and
   that tier's smallest padding, worked out at the narrowest window the class covers — a wider
   window only widens the card. The larger tier always shows the mount, so the reveal is the
   width tier's own.

   Such a window is landscape, and its height is at most the height cap plus the halved ground top
   and bottom, so its side ground is exactly double the halved ground. */
function tierLine(
  fit: MeasuredFit,
  widthTier: WidthTier,
  groundTier: GroundTier,
  narrowestWindow: number,
): number {
  const halved = groundTier.ground * GROUND_HALVING;
  const padding = smallestPadding(groundTier);
  const heights = fitRectangles(
    fit.regimes[widthTier],
    REVEAL[widthTier],
    padding,
  )
    .filter(
      (rectangle) =>
        rectangle.minCardHeight <= CARD_HEIGHT_CAP &&
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

function assertValidFit(fit: MeasuredFit): void {
  if (!SECTION_NAME.test(fit.section)) {
    throw new Error(
      `mounted-sheet-frame: section name "${fit.section}" must be lowercase letters, digits and hyphens, starting with a letter, because it becomes a class name.`,
    );
  }
  for (const [widthTier, regimes] of Object.entries(fit.regimes)) {
    if (regimes.length === 0) {
      throw new Error(
        `mounted-sheet-frame: section "${fit.section}" has no measured regimes for ${widthTier} type.`,
      );
    }
    regimes.forEach((regime, index) => {
      const valid =
        Number.isFinite(regime.minContentWidth) &&
        Number.isFinite(regime.contentHeight) &&
        regime.minContentWidth > 0 &&
        regime.contentHeight > 0 &&
        (index === 0 ||
          regime.minContentWidth > regimes[index - 1].minContentWidth);
      if (!valid) {
        throw new Error(
          `mounted-sheet-frame: section "${fit.section}", ${widthTier} regime ${index} is invalid. Widths and heights must be positive, and widths strictly ascending.`,
        );
      }
    });
  }
}

interface TierLines {
  tablet: number;
  laptop: number;
  laptopTouchscreen: number;
}

function tierLines(fit: MeasuredFit): TierLines {
  assertValidFit(fit);
  const md = breakpointPx(BREAKPOINT_REM.md);
  const lg = breakpointPx(BREAKPOINT_REM.lg);
  return {
    tablet: tierLine(fit, "tablet", GROUND_TIERS.tablet, md),
    laptop: tierLine(fit, "desktop", GROUND_TIERS.laptop, lg),
    /* A touchscreen window at `{breakpoints.lg}` and wider takes tablet ground with desktop type. */
    laptopTouchscreen: tierLine(fit, "desktop", GROUND_TIERS.tablet, lg),
  };
}

/* Every window falls in exactly one class: three width tiers, split by height at each tier line,
   and at `{breakpoints.lg}` and wider split by primary pointer as well. */
export function windowClasses(fit: MeasuredFit): WindowClass[] {
  const lines = tierLines(fit);
  const md = `${BREAKPOINT_REM.md}rem`;
  const lg = `${BREAKPOINT_REM.lg}rem`;
  const tabletWidth = `(${md} <= width < ${lg})`;
  const desktopPointer = `(width >= ${lg}) and (not ${TOUCHSCREEN_QUERY})`;
  const desktopTouchscreen = `(width >= ${lg}) and ${TOUCHSCREEN_QUERY}`;
  const atOrAbove = (line: number) => `(height >= ${formatPx(line)})`;
  const below = (line: number) => `(height < ${formatPx(line)})`;

  return [
    {
      media: `(width < ${md})`,
      widthTier: "mobile",
      groundTier: GROUND_TIERS.phone,
      regimes: fit.regimes.mobile,
      portraitPossible: true,
    },
    {
      media: `${tabletWidth} and ${atOrAbove(lines.tablet)}`,
      widthTier: "tablet",
      groundTier: GROUND_TIERS.tablet,
      regimes: fit.regimes.tablet,
      portraitPossible: true,
    },
    {
      media: `${tabletWidth} and ${below(lines.tablet)}`,
      widthTier: "tablet",
      groundTier: GROUND_TIERS.phone,
      regimes: fit.regimes.tablet,
      portraitPossible: false,
    },
    {
      media: `${desktopPointer} and ${atOrAbove(lines.laptop)}`,
      widthTier: "desktop",
      groundTier: GROUND_TIERS.laptop,
      regimes: fit.regimes.desktop,
      portraitPossible: true,
    },
    {
      media: `${desktopPointer} and ${below(lines.laptop)}`,
      widthTier: "desktop",
      groundTier: GROUND_TIERS.phone,
      regimes: fit.regimes.desktop,
      portraitPossible: false,
    },
    {
      media: `${desktopTouchscreen} and ${atOrAbove(lines.laptopTouchscreen)}`,
      widthTier: "desktop",
      groundTier: GROUND_TIERS.tablet,
      regimes: fit.regimes.desktop,
      portraitPossible: true,
    },
    {
      media: `${desktopTouchscreen} and ${below(lines.laptopTouchscreen)}`,
      widthTier: "desktop",
      groundTier: GROUND_TIERS.phone,
      regimes: fit.regimes.desktop,
      portraitPossible: false,
    },
  ];
}
