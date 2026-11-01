/* THE THREAD'S TOKENS — read from the built stylesheet rather than copied, for the drawing head, the
   re-trace, the tapered ends and the closing stretch's scroll budget. Each reader asks the browser
   (`getComputedStyle`), so each is called from an effect or a measure, never at module top level. */

import {
  HEAD_LENGTH_RATIO,
  type HeadOptions,
  lighter,
  type Rgb,
} from "./thread-head.ts";
import {
  CHAIN_TERMINAL_WINDOW,
  type TerminalWindow,
} from "./thread-progress.ts";
import {
  parseCssCount,
  parseCssTime,
  RETRACE_LENGTH_RATIO,
} from "./thread-retrace.ts";
import { readVariant } from "./thread-variant.ts";

/* Read from the built stylesheet rather than copied, so a token edit cannot leave the head behind. */
export function tokenLength(token: string): number {
  return Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue(token),
  );
}

/* The closing stretch's scroll budget, resolved against the CURRENT viewport. Both tokens are
   fractions of the viewport's height rather than px, so one value holds at every band (`tokens.css`
   carries the reasoning and the measurements). Read at measure time, never per scroll frame:
   `pageDrawnLength` is deliberately free of DOM reads so a scroll frame touches nothing but
   `window.scrollY`, and `getComputedStyle` here would force a style recalc on every one. A tuning
   surface therefore lands on the next re-measure, which a `resize` event is enough to trigger. */
export function readTerminalWindow(viewportHeight: number): TerminalWindow {
  const span = tokenLength("--thread-terminal-span");
  const finish = tokenLength("--thread-terminal-finish");
  if (!Number.isFinite(span) || !Number.isFinite(finish)) {
    return CHAIN_TERMINAL_WINDOW;
  }
  return {
    span: Math.max(0, span) * viewportHeight,
    finish: Math.max(0, finish) * viewportHeight,
  };
}

function tokenColour(token: string): Rgb {
  const probe = document.createElement("span");
  /* Out of flow: `<body>` is a flex container, and an in-flow box is a flex item even at zero height. */
  probe.style.position = "absolute";
  probe.style.color = `var(${token})`;
  document.body.append(probe);
  const [r = 0, g = 0, b = 0] =
    getComputedStyle(probe)
      .color.match(/[\d.]+/g)
      ?.map(Number) ?? [];
  probe.remove();
  return [r, g, b];
}

/* The shipped head, the head with any review choice over it, and the re-trace each resolve their tokens
   once per load and hand back the same object (`stackFor` keys its cache on that identity), so a retuned token takes effect on a reload, the gallery's
   specimens included, not on a hot update. */
let resolvedShippedHead: HeadOptions | undefined;
let resolvedHeadOptions: HeadOptions | undefined;

function shippedHead(): HeadOptions {
  if (resolvedShippedHead !== undefined) return resolvedShippedHead;
  const baseWidth = tokenLength("--stroke-thread");
  resolvedShippedHead = {
    length: HEAD_LENGTH_RATIO * baseWidth,
    tipWidth: baseWidth,
    baseWidth,
    tailColor: tokenColour("--color-thread-red"),
    midColor: tokenColour("--color-thread-sheen-mid"),
    tipColor: tokenColour("--color-thread-sheen"),
  };
  return resolvedShippedHead;
}

/* The head as shipped, or the review panel's `light` candidate over it. The re-trace builds on the
   same options, so the drawing head and the re-trace always carry one look as a pair. */
export function headOptions(): HeadOptions {
  resolvedHeadOptions ??= {
    ...shippedHead(),
    ...sheenFor(readVariant("light")),
  };
  return resolvedHeadOptions;
}

/* The drawing head's own values with the re-trace's peak length: the head's options, read once from
   the same tokens, not a second copy of any of them. */
let resolvedRetraceOptions: HeadOptions | undefined;

export function retraceOptions(): HeadOptions {
  resolvedRetraceOptions ??= retraceFrom(
    headOptions(),
    tokenLength("--stroke-thread"),
  );
  return resolvedRetraceOptions;
}

/* The re-trace is the head's look at its own peak length: everything but the length comes from the
   head, so the two can never be judged apart. */
export function retraceFrom(head: HeadOptions, stroke: number): HeadOptions {
  return { ...head, length: RETRACE_LENGTH_RATIO * stroke };
}

/* The review panel's light candidates: `sheen-<L>-<glow>` paints the head and the re-trace in a lighter
   stretch of the thread's own red — the tip L hundredths of OKLCH lightness over it, the middle half
   that — at the ink's own width; `orange` is the earlier head's colours, vermilion and the hot core, at the same width. The glow
   is the panel's property and stylesheet. */
function sheenFor(id: string | undefined): Partial<HeadOptions> {
  if (id === "orange")
    return {
      midColor: tokenColour("--color-thread-vermilion"),
      tipColor: tokenColour("--color-thread-core"),
    };
  const match = /^sheen-(\d+)-\w+$/.exec(id ?? "");
  if (match === null) return {};
  return sheenColours(
    tokenColour("--color-thread-red"),
    Number(match[1]) / 100,
    tokenLength("--stroke-thread"),
  );
}

export function sheenColours(
  red: Rgb,
  lift: number,
  stroke: number,
): Partial<HeadOptions> {
  return {
    tipWidth: stroke,
    midColor: lighter(red, lift / 2),
    tipColor: lighter(red, lift),
  };
}

export function tokenTime(token: string): number | undefined {
  return parseCssTime(
    getComputedStyle(document.documentElement).getPropertyValue(token),
  );
}

/* Read once: it is asked for on every frame that advances the drawn length, which is every frame of
   the opening draw and of the first descent. */
let resolvedRetraceSettle: number | undefined;

export function retraceSettle(): number | undefined {
  resolvedRetraceSettle ??= tokenTime("--retrace-settle");
  return resolvedRetraceSettle;
}

/* The budget of whole loops, read once like the settle: a malformed token stays undefined and the loop
   never starts. */
let resolvedRetraceLoops: number | undefined;

export function retraceLoops(): number | undefined {
  resolvedRetraceLoops ??= parseCssCount(
    getComputedStyle(document.documentElement).getPropertyValue(
      "--retrace-loops",
    ),
  );
  return resolvedRetraceLoops;
}

export interface TaperOptionsResolved {
  readonly taperLength: number;
  readonly strokeWidth: number;
}

/* Read at each measure rather than cached, so a retuned token takes effect on the next re-measure. */
export function taperOptions(): TaperOptionsResolved {
  const root = getComputedStyle(document.documentElement);
  return {
    taperLength: Number.parseFloat(
      root.getPropertyValue("--length-thread-taper"),
    ),
    strokeWidth: Number.parseFloat(root.getPropertyValue("--stroke-thread")),
  };
}
