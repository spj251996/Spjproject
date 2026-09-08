"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

/* curate-gallery scaffold kit — click guards (skill → references/scaffold-kit.md).

   Both guards listen in the CAPTURE phase, so a router or component handler never sees the event.
   The tooltip is portaled to <body> rather than rendered inside the guard, because a ChromeFrame's
   `translateZ(0)` containing block would otherwise clip a fixed-position tip to the frame. */

const SUPPRESSED_MESSAGE =
  "Interactions are disabled in the design-system preview.";

const TIP_VISIBLE_MS = 1600;

interface TipPosition {
  x: number;
  y: number;
}

function SuppressionTip({ position }: { position: TipPosition | null }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || position === null) {
    return null;
  }

  return createPortal(
    <div
      /* max-w is a gallery layout constant (skill → visualizer-kit.md → documented bare-px
         exceptions); the offset keeps the tip clear of the cursor. */
      className="type-body pointer-events-none fixed z-(--z-modal) max-w-[240px] rounded-sm border-(length:--stroke-divider) border-accent-gold-on-base bg-surface-elevated px-space-sm py-space-xs text-ink"
      role="status"
      style={{ left: position.x + 12, top: position.y + 12 }}
    >
      {SUPPRESSED_MESSAGE}
    </div>,
    document.body,
  );
}

function useSuppressionTip() {
  const [position, setPosition] = useState<TipPosition | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  const show = useCallback((x: number, y: number) => {
    setPosition({ x, y });
    if (timer.current !== null) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => setPosition(null), TIP_VISIBLE_MS);
  }, []);

  return { position, show };
}

interface GuardProps {
  className?: string;
  children: ReactNode;
}

/* Wraps the whole gallery content area — one per page, not one per specimen. Blocks anchor
   navigation only; buttons, hover and focus-visible stay live so interaction states remain
   demonstrable. Renders as <article> because the skill's section rail scrapes h2s from it. */
export function DemoViewOnly({ className, children }: GuardProps) {
  const { position, show } = useSuppressionTip();

  return (
    <article
      className={className}
      onClickCapture={(event) => {
        if ((event.target as HTMLElement).closest("a[href]") === null) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        show(event.clientX, event.clientY);
      }}
    >
      {children}
      <SuppressionTip position={position} />
    </article>
  );
}

/* Per-specimen guard for components whose buttons would fire real state changes. Always nested
   INSIDE DemoViewOnly; stopPropagation keeps the outer anchor guard from showing a second tip. */
export function InertDemo({ className, children }: GuardProps) {
  const { position, show } = useSuppressionTip();

  return (
    <div
      className={className}
      onClickCapture={(event) => {
        event.stopPropagation();
        event.preventDefault();
        show(event.clientX, event.clientY);
      }}
    >
      {children}
      <SuppressionTip position={position} />
    </div>
  );
}
