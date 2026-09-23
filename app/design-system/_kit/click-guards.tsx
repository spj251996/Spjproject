"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

/* Both guards listen in the capture phase, so a router or component handler never sees the event.
   The tip is portaled to <body>: inside a ChromeFrame, its `translateZ(0)` containing block would
   clip a fixed-position tip to the frame. */

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
      /* Dev chrome: the 240px cap and the 12px cursor offset are gallery layout constants, and the
         tip takes the top layer of the z-index scale so it clears every demo, the thread included. */
      className="type-body pointer-events-none fixed z-(--z-modal) max-w-[240px] bg-surface-elevated shadow-stock px-space-sm py-space-xs text-ink"
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

/* One per page, around the whole content area. Blocks anchor navigation only, so buttons, hover and
   focus-visible stay demonstrable. */
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

/* Per-specimen guard for buttons that would fire real state changes. Nested inside DemoViewOnly;
   stopPropagation keeps the outer guard from showing a second tip. */
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
