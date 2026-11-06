import {
  type Box,
  ENTRANCE,
  type EntranceFrame,
  type EntranceInput,
  type Point,
} from "./thread-entrance";
import { type FrayShape, placeFray } from "./thread-fray";
import {
  CONTACT_SHADOW,
  FIBRE_SHADOW,
  type ThreadFilter,
} from "./thread-shadows";

const SVG_NS = "http://www.w3.org/2000/svg";
/* The fewest points a route needs: the cord's length past the start and a sample to read its direction by. */
const ROUTE_SAMPLES = ENTRANCE.length + 2;

function element<K extends keyof SVGElementTagNameMap>(
  name: K,
  attributes: Record<string, string> = {},
) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes))
    node.setAttribute(key, value);
  return node;
}

/* The entrance's own copy of a shadow, its region the window (plus the shadow's reach), in the thread's user
   space. The page's shared filters size their region by each element's box, which clips a near-flat bundle's
   shadow, and a page-length region renders soft in WebKit (DESIGN.md -> Thread -> The contact shadow). */
function shadowFilter(recipe: ThreadFilter, id: string, view: Box) {
  const filter = element("filter", {
    id,
    filterUnits: "userSpaceOnUse",
    "color-interpolation-filters": "sRGB",
    x: String(view.left - 60),
    y: String(view.top - 60),
    width: String(view.right - view.left + 120),
    height: String(view.bottom - view.top + 120),
  });
  for (const layer of recipe.layers) {
    const drop = element("feDropShadow", {
      dx: "0",
      dy: String(layer.offsetY),
      stdDeviation: String(layer.blur),
    });
    drop.setAttribute(
      "style",
      `flood-color: var(${layer.colour}); flood-opacity: ${layer.alpha}`,
    );
    filter.append(drop);
  }
  return filter;
}

const polyline = (points: readonly Point[]) =>
  points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join("");

/* Draws an entrance's frames into the live thread `<svg>`, above everything else in it, and removes every trace
   of them on `clear()`. */
export function createEntrancePainter(
  svg: SVGSVGElement,
  view: Box,
  fray: FrayShape,
) {
  const group = element("g", { "data-thread-entrance": "" });
  const defs = element("defs");
  defs.append(
    shadowFilter(CONTACT_SHADOW, "thread-entrance-cord-shadow", view),
    shadowFilter(FIBRE_SHADOW, "thread-entrance-fibre-shadow", view),
  );
  const ink = (width: string, cap: string) => {
    const path = element("path");
    path.setAttribute(
      "style",
      `fill: none; stroke: var(--color-thread-red); stroke-width: ${width}; stroke-linecap: ${cap}`,
    );
    return path;
  };
  const fibreGroup = element("g", {
    filter: "url(#thread-entrance-fibre-shadow)",
  });
  const fibres = Array.from({ length: ENTRANCE.fibres }, () =>
    ink(`${ENTRANCE.fibreWidth}px`, "round"),
  );
  fibreGroup.append(...fibres);
  const coreGroup = element("g", {
    filter: "url(#thread-entrance-cord-shadow)",
  });
  const cores = [0, 1, 2].map(() => ink("0", "round"));
  coreGroup.append(...cores);
  const cord = ink("var(--stroke-thread)", "butt");
  cord.setAttribute("filter", "url(#thread-entrance-cord-shadow)");
  const frayGroup = element("g", {
    filter: "url(#thread-entrance-cord-shadow)",
  });
  const frayFibres = fray.fibres.map((fibre) => {
    const path = ink(`${fibre.width.toFixed(3)}px`, "round");
    frayGroup.append(path);
    return path;
  });
  group.append(defs, fibreGroup, coreGroup, cord, frayGroup);
  svg.append(group);

  return {
    paint(frame: EntranceFrame) {
      frame.fibres.forEach((points, index) => {
        fibres[index].setAttribute("d", points ? polyline(points) : "");
      });
      cores.forEach((path, index) => {
        const core = frame.cores[index];
        path.setAttribute("d", core ? polyline(core.points) : "");
        if (core) path.style.strokeWidth = `${core.width.toFixed(3)}px`;
      });
      cord.setAttribute("d", frame.cord.map(polyline).join(""));
      const ds = placeFray(fray, {
        x: frame.tail.x,
        y: frame.tail.y,
        tx: Math.cos(frame.tail.angle),
        ty: Math.sin(frame.tail.angle),
      });
      frayFibres.forEach((path, index) => {
        path.setAttribute("d", ds[index]);
      });
      frayGroup.style.opacity = String(frame.frayOpacity);
    },
    clear() {
      group.remove();
    },
  };
}

export type EntrancePainter = ReturnType<typeof createEntrancePainter>;

/* The window, the invite's eyebrow and piece 0's first stretch in the thread's user space, read at the current
   scroll. `pieceZeroD` is piece 0's unswayed `d`, sampled on a hidden copy so the sway never bends the route. */
export function entranceInput(
  svg: SVGSVGElement,
  pieceZeroD: string | undefined,
  eyebrow: Element | null,
  cordWidth: number,
  frayLength: number,
  drawSpeed: number,
  seed: number,
): EntranceInput | undefined {
  const ctm = svg.getScreenCTM();
  if (pieceZeroD === undefined || ctm === null || !(drawSpeed > 0))
    return undefined;
  const inverse = ctm.inverse();
  const toUser = (x: number, y: number) =>
    new DOMPoint(x, y).matrixTransform(inverse);
  const userBox = (
    left: number,
    top: number,
    right: number,
    bottom: number,
  ) => {
    const a = toUser(left, top);
    const b = toUser(right, bottom);
    return {
      left: Math.min(a.x, b.x),
      top: Math.min(a.y, b.y),
      right: Math.max(a.x, b.x),
      bottom: Math.max(a.y, b.y),
    };
  };
  const probe = element("path", { d: pieceZeroD, visibility: "hidden" });
  svg.append(probe);
  const total = probe.getTotalLength();
  const route: Point[] = [];
  for (let u = 0; u <= Math.min(total, 300); u += 1) {
    const p = probe.getPointAtLength(u);
    route.push({ x: p.x, y: p.y });
  }
  probe.remove();
  if (route.length < ROUTE_SAMPLES) return undefined;
  const rect = eyebrow?.getBoundingClientRect();
  return {
    route,
    eyebrow: rect
      ? userBox(rect.left, rect.top, rect.right, rect.bottom)
      : undefined,
    view: userBox(0, 0, window.innerWidth, window.innerHeight),
    drawSpeed,
    cordWidth,
    frayLength,
    seed,
  };
}

/* When the invite's last line of type lands, on the document timeline (`performance.now()`'s clock): the latest
   end of the invite's own animations, or the token's 1800ms when none can be read. */
export async function typeLandedAt(
  invite: Element | null,
  fallback: number,
): Promise<number> {
  const animations = document.getAnimations().filter((animation) => {
    const effect = animation.effect;
    return (
      effect instanceof KeyframeEffect &&
      effect.target !== null &&
      invite?.contains(effect.target) === true
    );
  });
  await Promise.all(
    animations.map((animation) => animation.ready.catch(() => animation)),
  );
  let end = 0;
  for (const animation of animations) {
    const endTime = Number(animation.effect?.getComputedTiming().endTime);
    if (animation.startTime === null || !Number.isFinite(endTime)) continue;
    end = Math.max(end, Number(animation.startTime) + endTime);
  }
  return end > 0 ? end : fallback;
}
