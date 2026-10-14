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
   screen.

   ON 2026-10-14 THE OWNER'S OWN QUESTIONS REPLACED THE COUPLE'S: the family photos, the progress
   line, the opening (Bloom) and the phone paper were each picked on a phone and left the route the
   same day. The invite's phone spacing (one 24px gap) left too. What it carries now is Event Info's phone spacing. */

/* THE WHOLE ATTRIBUTE VOCABULARY, and the only list of it. Every name is namespaced.
   WHY THE NAMESPACE IS LOAD-BEARING: `app/layout.tsx` sets `data-opening-skipped` on this SAME
   element before hydration, and `app/invite.css` plus `components/thread/thread.module.css` both
   read `:root:not([data-opening-skipped])`. A panel that cleared or rewrote the root's attribute
   set would re-arm the invite's 1600ms opening in the middle of a scroll. One prefix makes the
   gate in `preview-route.test.ts` a guard rather than a list of names it has to forgive.

   THE OPENING'S ATTRIBUTE IS NOT HERE, deliberately. `page.tsx`'s one-shot inline script applies it
   before first paint so a candidate plays as a true arrival; this list is what the sync effect below
   removes when a control is shipped, so naming it would strip the candidate at mount and cut it
   mid-flight. */
const ATTRIBUTES = ["data-pv-event-rhythm"] as const;

/* FIVE LEVERS HAVE LEFT SINCE THE FIRST CUT (owner, 2026-10-10), and each is named so none reads
   as having been dropped by accident.

   THREE WERE SETTLED and landed as values rather than as the factors the route carried them as:
   the ritual title's size in `app/styles/tokens.css` (up 8% then; 18px on a phone since
   2026-10-11); the ampersand is drawn 35% SMALLER in
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
  /* Empty IS the shipped state — see the contract above. */
  attrs: Readonly<Record<string, string>>;
}

interface Lever {
  id: string;
  title: string;
  options: readonly Option[];
}

/* The open questions. Option 0 of each is what ships today, so an untouched panel shows the
   published page and there is nothing to jump on first paint.

   SIX LEFT ON 2026-10-11 (owner) AND EACH LANDED AS A VALUE: the date block's inner spacing (8px;
   4px on a phone since 2026-10-14)
   and the day's weight (400) in `app/styles/tokens.css` and `app/_sections/invite.tsx`; the gold
   glow on the couple's portraits (medium) in `components/ui/portrait.tsx`; the rituals left-aligned
   in `app/_sections/celebrations.tsx`; and the timeline card's 36px phone padding in
   `components/layout/mounted-sheet-frame.ts`. `preview-route.test.ts` checks them at their
   destinations; rounds 7–9's picks landed the same way and `app/round7-9.test.ts` pins them. */
const COUPLE_LEVERS: readonly Lever[] = [
  {
    id: "event-rhythm",
    title: "Event spacing on phones",
    options: [
      { label: "As now", attrs: {} },
      { label: "Natural", attrs: { "data-pv-event-rhythm": "natural" } },
      { label: "Even", attrs: { "data-pv-event-rhythm": "even" } },
    ],
  },
];

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
  COUPLE_LEVERS.map((lever) => [lever.id, 0]),
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
      {lever.options.map((option, index) => (
        <label key={option.label} style={CHOICE}>
          {/* `onClick` AS WELL AS `onChange`, and it is the couple's first tap that needs it.
              This panel is server-rendered OPEN, so its radios are tappable long before React
              hydrates — on a phone over a mobile connection that window is the normal case. A tap
              landing in it flips the DOM's own `checked` without changing React state, and from
              then on a click on an ALREADY-CHECKED radio fires no `change` event at all, so
              `onChange` alone leaves the control dead until two further taps move the selection
              away and back. Measured, not reasoned: with the chunks delayed, two taps applied
              nothing. `onClick` fires on every click including that one, so the second tap
              recovers; firing both on an ordinary selection is harmless, since choosing the same
              index twice is idempotent. The mount effect below repairs the lie in the meantime. */}
          <input
            checked={chosen === index}
            name={`pv-${lever.id}`}
            onChange={() => onChoose(index)}
            onClick={() => onChoose(index)}
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

  /* REPAIR ANY PRE-HYDRATION TAP, so the panel never shows a selection the page is not in.
     React does not reconcile a radio's `checked` that the DOM changed under it — the state it
     rendered has not changed, so there is nothing to re-render — and the result is a control
     reading as chosen over a page that is still shipped. One pass at mount puts every radio back
     in step with the state that is actually applied. It runs once, so it cannot fight a real
     selection. */
  useEffect(() => {
    /* Against SHIPPED rather than against `chosen`, which is what makes this a mount-only effect
       with no dependency to declare: no lever's state is restored from storage, so at mount the
       state IS the shipped set. */
    for (const lever of COUPLE_LEVERS) {
      const wanted = SHIPPED[lever.id] ?? 0;
      const radios = document.querySelectorAll<HTMLInputElement>(
        `input[name="pv-${lever.id}"]`,
      );
      radios.forEach((radio, index) => {
        radio.checked = index === wanted;
      });
    }
  }, []);

  useEffect(() => {
    const wanted: Record<string, string> = {};
    for (const lever of COUPLE_LEVERS) {
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
      {/* THE CLOSE IS ALWAYS REACHABLE (owner, 2026-10-10). The panel scrolls on a short phone,
          where its group and notes outgrow 70svh, and the close button scrolled away with the heading, so
          getting the panel out of the way meant first scrolling back up inside it. It is sticky
          to the top of the panel's own scroll box now.
          The background is RESTATED rather than inherited: a sticky child paints over the content
          sliding beneath it, and `SHELL`'s background sits on the scroll container, not on this
          row. `top` is 0 and the padding moved onto this band: the negative inline margins with
          matching padding let it reach both edges while the groups below keep the panel's 14px
          inset. The comment above records why `top: -14` is NOT the way to do that. */}
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
          <strong>Options</strong>
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
      </div>

      {/* No notes and no reset — each group's "As now" is the reset (owner, 2026-10-14: "keep the
          panel clean and simple"). */}
      {COUPLE_LEVERS.map((lever) => (
        <LeverGroup
          chosen={chosen[lever.id] ?? 0}
          key={lever.id}
          lever={lever}
          onChoose={(index) => choose(lever.id, index)}
        />
      ))}
    </aside>
  );
}
