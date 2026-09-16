/* DESIGN.md → Foundations → Layout → `mounted-sheet` → The frame · When space runs out · Measured
   per section.

   What every framed section shares, and nothing any section measures: the ground tiers and their
   padding steps, the card caps, the touchscreen query, the arithmetic that turns measured content
   into card rectangles, and the tier lines derived from it. A section supplies its content as a
   `MeasuredFit`; mounted-sheet-frame-css.ts turns the two into that section's stylesheet.

   Plain data and arithmetic, with no React and no DOM, so plain node can import it as well as the
   app's bundler. */

/* Type follows these alone (Interaction Rules → Responsive Behavior). */
export type WidthTier = "mobile" | "tablet" | "desktop";

/* A section's content can stand a different height by orientation — the invite's couple names are
   three lines in portrait and one in landscape — so the frame measures and fits each on its own
   terms rather than judging one against the other's card (DESIGN.md → Measured per section). */
export type Orientation = "portrait" | "landscape";

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

/* Every consumer reads a width tier's regimes through this rather than indexing the record
   directly, so the orientation split has one seam. Takes a width tier's own record
   (`fit.regimes[tier]`, or a `WindowClass`'s, which carries the same shape straight through) rather
   than the whole fit, because `tierLine` picks an orientation before any `WindowClass` exists. */
export function regimesFor(
  regimes: Readonly<Record<Orientation, readonly FitRegime[]>>,
  orientation: Orientation,
): readonly FitRegime[] {
  return regimes[orientation];
}

interface GroundTier {
  name: GroundTierName;
  ground: number;
  /* Largest first. */
  paddingSteps: readonly number[];
}

/* `{spacing.*}` steps held as numbers, like the reveal ladder and the caps below, because a media
   query cannot read a custom property. A spacing token change must change them here, and the
   pixel-keyed spacing map in mounted-sheet-frame-css.ts. */
const GROUND_TIERS: Readonly<Record<GroundTierName, GroundTier>> = {
  phone: { name: "phone", ground: 16, paddingSteps: [32, 24, 16] },
  tablet: { name: "tablet", ground: 48, paddingSteps: [64, 48, 32] },
  laptop: { name: "laptop", ground: 96, paddingSteps: [96, 64, 48, 32] },
};

/* `{breakpoints.md}` and `{breakpoints.lg}`. The media queries use the rem form, as the type's own
   breakpoint variants do, so a window changes ground tier exactly where it changes type. The
   arithmetic needs pixels, and the two agree at the default 16px root. Held as numbers because a
   media query cannot read a custom property — a change to `--breakpoint-md` or `--breakpoint-lg`
   in app/styles/tokens.css must change them here too. */
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
  /* Both orientations' regimes for this class's width tier — never just the one a class happens to
     render, since a class above its tier line covers both. */
  regimes: Readonly<Record<Orientation, readonly FitRegime[]>>;
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
  /* A tier line only ever decides a landscape window (this function's own doc above), so it reads
     the landscape regimes even for a width tier whose windows can also be portrait. */
  const heights = fitRectangles(
    regimesFor(fit.regimes[widthTier], "landscape"),
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
const FIT_KEYS: readonly string[] = ["section", "regimes"];
const REGIME_KEYS = ["minContentWidth", "contentHeight"] as const;
const WIDTH_TIERS: readonly WidthTier[] = ["mobile", "tablet", "desktop"];
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
      `mounted-sheet-frame: ${label} has no regimes. A measured fit needs a portrait and a landscape set for mobile, tablet and desktop type.`,
    );
  }
  for (const key of Object.keys(byTier)) {
    if (!(WIDTH_TIERS as readonly string[]).includes(key)) {
      throw new Error(
        `mounted-sheet-frame: ${label} has an unknown width tier "${key}". The width tiers are mobile, tablet and desktop.`,
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
    /* A touchscreen window at `{breakpoints.lg}` and wider takes tablet ground with desktop
       type. */
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
