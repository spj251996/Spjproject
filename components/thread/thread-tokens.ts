/* THE THREAD'S TOKENS — read from the built stylesheet rather than copied, for the drawing head and
   the closing stretch's scroll budget. Each reader asks the browser
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

/* The head resolves its tokens once per load and hands back the same object
   (`stackFor` keys its cache on that identity), so a retuned token takes effect on a reload, the gallery's
   specimens included, not on a hot update. */
let resolvedShippedHead: HeadOptions | undefined;

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

export function headOptions(): HeadOptions {
  return shippedHead();
}

/* The sheen's two colours as a lift of the thread's red: the tip L of OKLCH lightness over it, the middle
   half that, at the ink's own width. The registry's `thread-sheen` and `thread-sheen-mid` are this at
   0.12, which `thread-tokens.test.ts` holds them to. */
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

/* A CSS time token, `2s` or `800ms`, in milliseconds; undefined when it is not one, so a missing or
   malformed token stops what it times rather than running it at a value nobody chose. */
export function parseCssTime(value: string): number | undefined {
  const match = value.trim().match(/^([\d.]+)(ms|s)$/);
  if (match === null) return undefined;
  const time = Number(match[1]) * (match[2] === "s" ? 1000 : 1);
  return time > 0 && Number.isFinite(time) ? time : undefined;
}

export function tokenTime(token: string): number | undefined {
  return parseCssTime(
    getComputedStyle(document.documentElement).getPropertyValue(token),
  );
}
