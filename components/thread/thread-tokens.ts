/* THE THREAD'S TOKENS — read from the built stylesheet rather than copied, for the drawing head, the
   re-trace, the tapered ends and the closing stretch's scroll budget. Each reader asks the browser
   (`getComputedStyle`), so each is called from an effect or a measure, never at module top level. */

import {
  HEAD_LENGTH_RATIO,
  type HeadOptions,
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

/* Both option builders resolve their tokens once per load and hand back the same object (`stackFor`
   keys its cache on that identity), so a retuned token takes effect on a reload, the gallery's
   specimens included, not on a hot update. */
let resolvedHeadOptions: HeadOptions | undefined;

export function headOptions(): HeadOptions {
  if (resolvedHeadOptions !== undefined) return resolvedHeadOptions;
  const baseWidth = tokenLength("--stroke-thread");
  resolvedHeadOptions = {
    length: HEAD_LENGTH_RATIO * baseWidth,
    tipWidth: tokenLength("--stroke-thread-head"),
    baseWidth,
    tailColor: tokenColour("--color-thread-red"),
    midColor: tokenColour("--color-thread-vermilion"),
    tipColor: tokenColour("--color-thread-core"),
  };
  return resolvedHeadOptions;
}

/* The drawing head's own settled values (the owner's ruling, 2026-10-02) with the re-trace's peak
   length: the head's options, read once from the same tokens, not a second copy of any of them. */
let resolvedRetraceOptions: HeadOptions | undefined;

export function retraceOptions(): HeadOptions {
  resolvedRetraceOptions ??= {
    ...headOptions(),
    length: RETRACE_LENGTH_RATIO * tokenLength("--stroke-thread"),
  };
  return resolvedRetraceOptions;
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
