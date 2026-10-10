"use client";

import { type CSSProperties, useCallback, useEffect, useState } from "react";

/* `/preview`'s lever panel. DESIGN.md → Technical Conventions → Variant Routes.

   THE CONTRACT, in one line: a control at its SHIPPED setting REMOVES its attribute, so with
   nothing touched the document root carries none and the route is byte-for-byte the published
   page. Shipped is therefore never a rule competing with a candidate's — it is the absence of
   every rule in `preview.css`.

   It is a SIBLING of the page, never a wrapper. A wrapping client boundary can establish a
   stacking context, and a stacking context on any ancestor of a `.botanical-piece` isolates
   `mix-blend-mode: multiply` — every drawing then composites its opaque white ground as a visible
   rectangle, with no error and every gate green.

   It SHIPS, unlike the scratch panels it replaces, so it passes lint, typecheck and the suite
   like any other file — an announced departure from `design-tweak`'s "the preview panel may be as
   rough as it likes", which assumes a route nobody but the author opens. The couple open this one
   on their own handsets, which is also why it is a bottom sheet that scrolls rather than a
   corner box: at 360px wide a fixed panel either covers what it is asking about or runs off the
   screen. */

/* THE WHOLE ATTRIBUTE VOCABULARY, and the only list of it. Every name is namespaced, including
   Event Info's four, which the scratch route carried as bare `data-rail` & co.
   WHY THE NAMESPACE IS LOAD-BEARING: `app/layout.tsx` sets `data-opening-skipped` on this SAME
   element before hydration, and `app/invite.css` plus `components/thread/thread.module.css` both
   read `:root:not([data-opening-skipped])`. A panel that cleared or rewrote the root's attribute
   set would re-arm the invite's 1600ms opening in the middle of a scroll. One prefix makes the
   gate in `preview-route.test.ts` a guard rather than a list of names it has to forgive. */
const ATTRIBUTES = [
  "data-pv-rail",
  "data-pv-dot-label",
  "data-pv-dot-place",
  "data-pv-icon-split",
  "data-pv-ornament",
  "data-pv-ritual-align",
] as const;

/* FIVE LEVERS HAVE LEFT SINCE THE FIRST CUT (owner, 2026-10-10), and each is named so none reads
   as having been dropped by accident.

   THREE WERE SETTLED and landed as values rather than as the factors the route carried them as:
   the ritual title is 21/23/21/25px in `app/styles/tokens.css` (up 8%, rounded to whole pixels per
   this project's own rule); the ampersand is drawn 35% SMALLER in
   `components/ui/couple-names.tsx`, keeping its full layout slot so the words do not move and
   neither measured fit changes; and the Malayalam is weight 600, the only cut `app/layout.tsx`
   loads. `preview-route.test.ts` checks the first two AT THEIR DESTINATIONS, because a stripped
   control with no landed value would read as a decision taken and leave the page on the old
   number.

   TWO WERE DROPPED WITHOUT BEING ARBITRATED HERE:
   - `data-pv-names`, the couple's names drawn against today's typeset script. The drawn asset
     ships and the couple are not asked (owner: "ship only drawn to couple, no need options").
   - `data-pv-eyebrow`, the flowers over the invite's eyebrow. The owner settled that clearance
     themselves on a render and accepted the residual bud as a Known Gap, so its two alternates
     were the only options here with no measurement behind them.

   AND TWO WENT THE OTHER WAY, from the owner's tuning levers to the couple's own questions:
   `data-pv-ornament`, and `data-pv-ritual-align` once nothing was left to tune (owner, same day).
   SO THERE IS NO TUNING BLOCK ANY MORE — every surviving lever is the couple's, which is also why
   the panel no longer carries a measurement readout. */

interface Option {
  label: string;
  note?: string;
  /* Empty IS the shipped state — see the contract above. */
  attrs: Readonly<Record<string, string>>;
}

interface Lever {
  id: string;
  title: string;
  note?: string;
  options: readonly Option[];
}

/* The three the couple decide. Option 0 of each is what ships today, so an untouched panel shows
   the recommended state and there is nothing to jump on first paint. */
const COUPLE_LEVERS: readonly Lever[] = [
  {
    id: "events",
    title: "The event details on a phone",
    /* PREVIEW ONLY, and the mark is not politeness. `app/event-info-fit.ts` is GENERATED from the
       shipped layout and a CSS override cannot re-derive it, so an alternate can in principle
       render a composition the production build will not produce. All six happen to measure
       1704px — identical to what ships — which is why `/` needs no new fit this round; the mark
       stays because the next candidate might not. */
    note: "Six arrangements of the same details. Preview only — the spacing is derived in code, so the final build may sit a few pixels off.",
    options: [
      { label: "Today's", attrs: {} },
      {
        label: "Centre line · time on the left, above the icon",
        attrs: {
          "data-pv-rail": "dot",
          "data-pv-dot-label": "time",
          "data-pv-dot-place": "above",
        },
      },
      {
        label: "Centre line · time on the left, below the icon",
        attrs: {
          "data-pv-rail": "dot",
          "data-pv-dot-label": "time",
          "data-pv-dot-place": "below",
        },
      },
      {
        label: "Centre line · event on the left, above the icon",
        attrs: {
          "data-pv-rail": "dot",
          "data-pv-dot-label": "event",
          "data-pv-dot-place": "above",
        },
      },
      {
        label: "Centre line · event on the left, below the icon",
        attrs: {
          "data-pv-rail": "dot",
          "data-pv-dot-label": "event",
          "data-pv-dot-place": "below",
        },
      },
      {
        label: "Icon on the line · time on the left",
        attrs: { "data-pv-rail": "icon", "data-pv-icon-split": "time" },
      },
      {
        label: "Icon on the line · time and event on the left",
        attrs: { "data-pv-rail": "icon", "data-pv-icon-split": "both" },
      },
    ],
  },
  {
    id: "ornament",
    title: "The leaf marks beside a heading",
    note: "Every section heading carries them. The second form adds a short rule either side.",
    options: [
      { label: "Leaves only", attrs: {} },
      { label: "Leaves between rules", attrs: { "data-pv-ornament": "rules" } },
    ],
  },
  {
    id: "ritual-align",
    title: "Ritual text alignment",
    /* CENTRED SHIPS as of 2026-10-10, so the two forms it replaced are the alternates and the
       lever is inverted from its first cut. Kept open for one more look rather than stripped with
       the decision — the one thing no figure settles is whether nine double-ragged lines read
       better than one ragged edge, and that is what a second look is for.
       THE RAIL IS A FOURTH FORM, not a variant of the other three (owner, 2026-10-10): one sprig
       per ritual as a timeline node, a gold spine down the left, the rituals hugging it, and the
       English title beside the Malayalam at every tier except phone. It is here to be compared
       against centred. */
    options: [
      /* Centred is FIRST because it is what ships, which is the promise the panel's own heading
         makes to the couple — "the first choice in each group is what the invitation shows now".
         The owner listed the four as left, centred, justified, rail; the set is theirs and only
         the order differs, so that promise is not broken for one group. */
      { label: "Centred", attrs: {} },
      { label: "Left", attrs: { "data-pv-ritual-align": "start" } },
      { label: "Justified", attrs: { "data-pv-ritual-align": "justify" } },
      {
        label: "Sprig rail down the left",
        attrs: { "data-pv-ritual-align": "rail" },
      },
    ],
  },
];

/* The owner's, settled on a render one at a time, and REMOVED with their controls once each value
   lands in the file that owns it (Task 9). The couple are not asked about any of these. */
const ALL_LEVERS = COUPLE_LEVERS;

const OPEN_KEY = "preview-panel-open";

/* Only the open flag persists. A chosen lever deliberately does not: the couple's answer is what
   they tell the owner, and a remembered selection would make a reload show someone else's pick as
   if it were the page. */
function readOpen(): boolean {
  try {
    return window.localStorage.getItem(OPEN_KEY) !== "0";
  } catch {
    /* Throws outright in a private window and with site data blocked. An unguarded read inside a
       client component blanks its whole subtree, which would leave the couple with the page and
       no panel at all — so this returns a usable default instead. */
    return true;
  }
}

function writeOpen(open: boolean): void {
  try {
    window.localStorage.setItem(OPEN_KEY, open ? "1" : "0");
  } catch {
    /* Nothing to do: the preference simply does not survive the reload. */
  }
}

/* THE MEASUREMENT READOUT IS GONE WITH THE TUNING BLOCK (owner, 2026-10-10: nothing needs tuning
   any more). It printed the window, Event Info's section height in viewports, and the venue and
   button line counts — the owner's own instrument for judging the six candidates, and of no use
   to the couple. Its `textLines` walker went with it; the finding that made it work is recorded
   where a later harness will need it rather than lost with the code: a block element's own
   `getClientRects()` is always ONE rect however many lines it holds, and ranging over an
   ELEMENT's contents returns a rect per inline child, so only walking to the TEXT NODES counts
   lines — an unwrapped button otherwise read as two, the shipped one included. */

const SHIPPED: Readonly<Record<string, number>> = Object.fromEntries(
  ALL_LEVERS.map((lever) => [lever.id, 0]),
);

const SHELL: CSSProperties = {
  position: "fixed",
  right: 12,
  bottom: 12,
  zIndex: 9999,
  background: "#fffdf8",
  border: "1px solid #d1c6b7",
  color: "#3a2a1e",
  boxShadow: "0 2px 16px rgba(0,0,0,0.16)",
  font: "13px/1.5 system-ui, sans-serif",
};

const CHOICE: CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "baseline",
  padding: "5px 0",
  cursor: "pointer",
};

function LeverGroup({
  lever,
  chosen,
  onChoose,
}: {
  lever: Lever;
  chosen: number;
  onChoose: (index: number) => void;
}) {
  return (
    <fieldset style={{ border: 0, margin: "0 0 14px", padding: 0 }}>
      <legend style={{ fontWeight: 700, padding: 0 }}>{lever.title}</legend>
      {lever.note === undefined ? null : (
        <p style={{ margin: "2px 0 4px", opacity: 0.75, fontSize: 12 }}>
          {lever.note}
        </p>
      )}
      {lever.options.map((option, index) => (
        <label key={option.label} style={CHOICE}>
          <input
            checked={chosen === index}
            name={`pv-${lever.id}`}
            onChange={() => onChoose(index)}
            type="radio"
          />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

export function LeverPanel() {
  const [chosen, setChosen] =
    useState<Readonly<Record<string, number>>>(SHIPPED);
  const [open, setOpen] = useState(true);

  /* Restore before anything persists: a save gated on first render would overwrite the stored
     value with the default before the restore had a chance to run. */
  useEffect(() => setOpen(readOpen()), []);

  useEffect(() => {
    const wanted: Record<string, string> = {};
    for (const lever of ALL_LEVERS) {
      Object.assign(wanted, lever.options[chosen[lever.id] ?? 0]?.attrs ?? {});
    }
    const root = document.documentElement;
    /* One pass over the vocabulary, so a name this panel no longer wants is REMOVED rather than
       left behind — which is what keeps "every control shipped" identical to a page that has
       never had an attribute set. Only these names are ever touched. */
    for (const name of ATTRIBUTES) {
      const value = wanted[name];
      if (value === undefined) root.removeAttribute(name);
      else root.setAttribute(name, value);
    }
  }, [chosen]);

  const choose = useCallback(
    (id: string, index: number) =>
      setChosen((previous) => ({ ...previous, [id]: index })),
    [],
  );

  if (!open) {
    return (
      <button
        aria-label="Open the options panel"
        onClick={() => {
          setOpen(true);
          writeOpen(true);
        }}
        style={{
          ...SHELL,
          width: 48,
          height: 48,
          borderRadius: 999,
          cursor: "pointer",
          fontSize: 20,
        }}
        type="button"
      >
        ☰
      </button>
    );
  }

  return (
    <aside
      aria-label="Preview options"
      style={{
        ...SHELL,
        borderRadius: 10,
        /* NO TOP PADDING: the sticky header below carries it instead, so `top: 0` can hold the
           band flush against the scroll-port's own edge. A `top: -14` cancelling a container
           padding looked equivalent and is not — it parks the band 14px OUTSIDE the visible box,
           which clipped 11px off the close button the moment the panel scrolled. Measured. */
        padding: "0 14px 14px",
        /* PINNED TO THE RIGHT EDGE AT EVERY WIDTH (owner, 2026-10-10). A first version set `left`
           as well as `right` with `margin-inline: auto`, which centred the panel over the card on
           anything wider than its own 360px cap — it has to sit beside what it is asking about,
           not on top of it. The cap is a `min()` rather than a `max-width` so a 360px phone keeps
           its 12px gutter on both sides instead of running the panel under the right edge. */
        width: "min(360px, calc(100vw - 24px))",
        maxHeight: "min(70svh, 560px)",
        overflowY: "auto",
        overscrollBehavior: "contain",
      }}
    >
      {/* THE CLOSE IS ALWAYS REACHABLE (owner, 2026-10-10). The panel scrolls — three groups plus a
          folded tuning block do not fit 70svh on a phone — and the close button scrolled away with
          the heading, so getting the panel out of the way meant first scrolling back up inside it.
          It is sticky to the top of the panel's own scroll box now.
          The background is RESTATED rather than inherited: a sticky child paints over the content
          sliding beneath it, and `SHELL`'s background sits on the scroll container, not on this
          row. `top: -14` cancels the container's own padding so the band sits flush at rest, and
          the negative inline margins with matching padding let it reach both edges while the
          groups below keep the panel's 14px inset. */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 1,
          background: "#fffdf8",
          marginInline: -14,
          paddingInline: 14,
          paddingBlock: "14px 8px",
          marginBottom: 10,
          borderBottom: "1px solid #e8dfd2",
        }}
      >
        <div
          style={{ display: "flex", justifyContent: "space-between", gap: 8 }}
        >
          <strong>A few things to choose</strong>
          <button
            aria-label="Close the options panel"
            onClick={() => {
              setOpen(false);
              writeOpen(false);
            }}
            style={{
              border: 0,
              background: "none",
              cursor: "pointer",
              font: "inherit",
              fontSize: 18,
              lineHeight: 1,
              /* The 44px touch floor as a HIT AREA rather than as a glyph, pulled back by its own
                 overhang so it does not push the heading's row taller. */
              minWidth: 44,
              minHeight: 44,
              margin: -12,
            }}
            type="button"
          >
            ✕
          </button>
        </div>
        <p style={{ margin: "2px 0 0", opacity: 0.75, fontSize: 12 }}>
          The first choice in each group is what the invitation shows now. Tell
          us which you prefer — nothing here saves.
        </p>
      </div>

      {COUPLE_LEVERS.map((lever) => (
        <LeverGroup
          chosen={chosen[lever.id] ?? 0}
          key={lever.id}
          lever={lever}
          onChoose={(index) => choose(lever.id, index)}
        />
      ))}

      <button
        onClick={() => setChosen(SHIPPED)}
        style={{
          font: "inherit",
          cursor: "pointer",
          padding: "6px 10px",
          borderRadius: 6,
          border: "1px solid #d1c6b7",
          background: "#fff",
          color: "inherit",
        }}
        type="button"
      >
        Back to how it is now
      </button>
    </aside>
  );
}
