/* THE THREAD'S ENTRANCE (DESIGN.md -> Motion -> The opening sequence -> The thread's entrance) — the scene, with no
   DOM. As the type lands the lab thread is spun from fibres while it travels into place: five fibres flow in from
   the top-left, each meets the moving bundle's head at its own point along a line above the eyebrow and twists in
   as it travels, the bundle thickening with each, and the finished cord runs into the thread's start, where the
   invite's timed draw is released and carries on at the bundle's speed. The far end then settles onto the start,
   where the thread's own frayed end takes over.

   Everything here is measured in the thread's own user space (page pixels, 1:1). The painter
   (`thread-entrance-painter.ts`) reads the inputs off the page and draws the frames. */

export type Point = { x: number; y: number };
export type Box = { left: number; top: number; right: number; bottom: number };

/* The owner's values, signed off on the spike (2026-11-05). */
export const ENTRANCE = {
  fibres: 5,
  length: 120,
  fibreWidth: 0.9,
  spread: 5,
  gapMs: 180,
  zone: 70,
  pitch: 28,
  turnsPerSecond: 0.8,
  fibreWiggle: 6,
  bundleWiggle: 4,
  calm: 0.15,
  clearance: 16,
  bow: 10,
  inset: 28,
  outside: 30,
  pace: 0.75,
  curve: 120,
} as const;

export interface EntranceInput {
  /* Piece 0 sampled every 1px from its start, at least `ENTRANCE.length` + 2 points. */
  route: readonly Point[];
  eyebrow: Box | undefined;
  view: Box;
  /* px/ms of the timed draw: its target length over its duration. */
  drawSpeed: number;
  cordWidth: number;
  /* How far the cord stops short of the thread's end for its fray (`frayShape(cordWidth).length`). */
  frayLength: number;
  seed: number;
}

export interface EntranceFrame {
  fibres: (readonly Point[] | null)[];
  cores: { width: number; points: readonly Point[] }[];
  cord: (readonly Point[])[];
  /* The cord's cut at its far end — where the fray's fibres start — and the way they point, in radians. */
  tail: { x: number; y: number; angle: number };
  frayOpacity: number;
}

export interface EntranceScene {
  release: number;
  land: number;
  frame(elapsed: number, drawn: number): EntranceFrame;
  /* Probes: when each joining fibre meets the head, where the head is, where the thread's start lies on the line,
     and the line itself. */
  joinTimes: readonly number[];
  headAt(elapsed: number): number;
  startArc: number;
  line: readonly Point[];
}

/* A late start is never fast-forwarded: the entrance runs in full from the moment it is ready. */
export function entranceStartAt(typeLanded: number, ready: number): number {
  return Math.max(typeLanded, ready);
}

/* Where `closed` fibres are twisted together, the bundle's width steps evenly from one fibre's to the cord's. */
export function coreWidth(
  closed: 2 | 3 | 4,
  fibreWidth: number,
  cordWidth: number,
): number {
  return (
    fibreWidth +
    ((cordWidth - fibreWidth) * (closed - 1)) / (ENTRANCE.fibres - 1)
  );
}

type Track = { points: Point[]; cumulative: number[]; length: number };

const TAU = Math.PI * 2;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => {
  const c = clamp01(v);
  return c * c * (3 - 2 * c);
};
/* Flatter at both ends than `smooth`, so a fibre eases into and out of the twist rather than snapping. */
const smoother = (v: number) => {
  const c = clamp01(v);
  return c * c * c * (c * (c * 6 - 15) + 10);
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* A wiggle that wanders rather than repeats (owner: never a sine): smooth value noise in two octaves drifting
   opposite ways along a strand, each on its own random lattice. Roughly −1…1. */
export function makeWiggle(random: () => number) {
  const lattice = (count: number) => {
    const values = Array.from({ length: count }, () => random() * 2 - 1);
    return (x: number) => {
      const i = Math.floor(x);
      const f = x - i;
      const a = values[((i % count) + count) % count];
      const b = values[(((i + 1) % count) + count) % count];
      return a + (b - a) * f * f * (3 - 2 * f);
    };
  };
  const broad = lattice(97);
  const fine = lattice(89);
  return (along: number, time: number) =>
    0.7 * broad(along / 85 - time / 1500) +
    0.45 * fine(along / 31 + time / 1100);
}

function track(points: Point[]): Track {
  const cumulative = [0];
  for (let i = 1; i < points.length; i++)
    cumulative.push(
      cumulative[i - 1] +
        Math.hypot(
          points[i].x - points[i - 1].x,
          points[i].y - points[i - 1].y,
        ),
    );
  return { points, cumulative, length: cumulative[cumulative.length - 1] };
}

/* The point at arc length `u` along a track, its unit tangent and its unit normal. */
function along(t: Track, u: number) {
  const at = Math.min(t.length, Math.max(0, u));
  let lo = 0;
  let hi = t.cumulative.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (t.cumulative[mid] <= at) lo = mid;
    else hi = mid;
  }
  const a = t.points[lo];
  const b = t.points[hi];
  const span = t.cumulative[hi] - t.cumulative[lo] || 1;
  const f = (at - t.cumulative[lo]) / span;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  return {
    x: a.x + dx * f,
    y: a.y + dy * f,
    tx: dx / length,
    ty: dy / length,
    nx: -dy / length,
    ny: dx / length,
  };
}

function cubic(p0: Point, p1: Point, p2: Point, p3: Point, steps: number) {
  const points: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    points.push({
      x:
        u ** 3 * p0.x +
        3 * u * u * t * p1.x +
        3 * u * t * t * p2.x +
        t ** 3 * p3.x,
      y:
        u ** 3 * p0.y +
        3 * u * u * t * p1.y +
        3 * u * t * t * p2.y +
        t ** 3 * p3.y,
    });
  }
  return points;
}

/* A point `at` (0–1) of the way along the window's top-left edges — from a third of the way across the top, to the
   corner, then down the left edge to two thirds of its height — pushed `outside` beyond them. */
function topLeftEdge(at: number, box: Box, outside: number): Point {
  const topSpan = (box.right - box.left) / 3;
  const leftSpan = ((box.bottom - box.top) * 2) / 3;
  const travelled = at * (topSpan + leftSpan);
  return travelled < topSpan
    ? { x: box.left + topSpan - travelled, y: box.top - outside }
    : { x: box.left - outside, y: box.top + travelled - topSpan };
}

/* How far a ray from `from` along unit `direction` travels before it leaves the box. */
function reach(from: Point, direction: Point, box: Box) {
  const hits = [
    direction.x > 0
      ? (box.right - from.x) / direction.x
      : Number.POSITIVE_INFINITY,
    direction.x < 0
      ? (box.left - from.x) / direction.x
      : Number.POSITIVE_INFINITY,
    direction.y > 0
      ? (box.bottom - from.y) / direction.y
      : Number.POSITIVE_INFINITY,
    direction.y < 0
      ? (box.top - from.y) / direction.y
      : Number.POSITIVE_INFINITY,
  ];
  return Math.max(0, Math.min(...hits));
}

const heading = (a: Point, b: Point) => {
  const span = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: (b.x - a.x) / span, y: (b.y - a.y) / span };
};

export function entranceScene(input: EntranceInput): EntranceScene {
  const { route, eyebrow, view, drawSpeed, frayLength } = input;
  const E = ENTRANCE;
  const random = mulberry32(input.seed);
  const length = Math.min(E.length, route.length - 2);
  const zone = E.zone;
  const start = route[0];
  const forward = heading(start, route[Math.min(6, route.length - 1)]);

  /* The line runs in the band between the window's top and the eyebrow, centred over it, then curves into the
     thread's start along the thread's own direction; then it is the thread's route. */
  const bandTop = view.top + E.inset;
  const bandBottom = Math.max(
    bandTop + 12,
    (eyebrow ? eyebrow.top : start.y - 40) - E.clearance,
  );
  const bow = Math.min(E.bow, (bandBottom - bandTop) * 0.35);
  const joinY = Math.min(
    bandBottom - bow - 6,
    Math.max(bandTop + bow + 6, start.y - 90),
  );
  const centreX = eyebrow
    ? (eyebrow.left + eyebrow.right) / 2
    : (view.left + view.right) / 2;

  /* The joins come `gapMs` apart, so before its start the line must carry the bundle far enough for all four and
     for the cord to close. It enters from the top edge inside its left third when that is long enough; otherwise
     from the left edge, as high as will do, rising along the margin before it turns along the band. */
  const startSpeed = drawSpeed * E.pace;
  const needed =
    E.outside +
    35 +
    1.5 * E.gapMs * (startSpeed + drawSpeed) +
    zone * 0.5 +
    length +
    20;
  const topSpan = (view.right - view.left) / 3;
  const leftSpan = ((view.bottom - view.top) * 2) / 3;
  const near = {
    x: Math.min(view.right - E.inset, centreX + length * 0.55),
    y: joinY,
  };
  const toStart = (from: Point, exit: Point) => {
    const span = Math.hypot(start.x - from.x, start.y - from.y);
    return cubic(
      from,
      { x: from.x + exit.x * span * 0.45, y: from.y + exit.y * span * 0.45 },
      {
        x: start.x - forward.x * span * 0.45,
        y: start.y - forward.y * span * 0.45,
      },
      start,
      80,
    );
  };
  const runFrom = (entry: Point, fromLeft: boolean) => {
    const rise =
      fromLeft && entry.y - joinY > 60
        ? cubic(
            entry,
            { x: view.left + 18, y: entry.y },
            { x: view.left + 18, y: joinY + 50 },
            { x: view.left + 40, y: joinY + 8 },
            Math.ceil((entry.y - joinY) / 4),
          )
        : [];
    const bandStart = rise.length > 0 ? rise[rise.length - 1] : entry;
    const leaving =
      rise.length > 0
        ? heading(rise[rise.length - 2], bandStart)
        : fromLeft
          ? { x: 1, y: 0 }
          : { x: 0, y: 1 };
    const reachBand = fromLeft
      ? Math.max(30, (near.x - bandStart.x) * 0.3)
      : (joinY - entry.y) * 1.2;
    const turnInto = {
      x: near.x - (near.x - bandStart.x) * 0.45,
      y: joinY - bow,
    };
    const band = cubic(
      bandStart,
      {
        x: bandStart.x + leaving.x * reachBand,
        y: bandStart.y + leaving.y * reachBand,
      },
      turnInto,
      near,
      120,
    );
    const run = [...rise, ...band.slice(rise.length > 0 ? 1 : 0)];
    return [...run, ...toStart(near, heading(turnInto, near)).slice(1)];
  };
  const candidates = [
    () =>
      runFrom(
        {
          x: Math.max(
            view.left + 12,
            Math.min(view.left + topSpan * 0.85, near.x - 140),
          ),
          y: view.top - E.outside,
        },
        false,
      ),
    ...[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1].map(
      (share) => () =>
        runFrom(
          { x: view.left - E.outside, y: view.top + leftSpan * share },
          true,
        ),
    ),
  ];
  let run: Point[] = [];
  for (const candidate of candidates) {
    run = candidate();
    if (track(run).length >= needed) break;
  }
  const line = track([...run.slice(0, -1), ...route.slice(0, length + 2)]);
  const runLength = track(run).length;
  const arcWhere = (test: (p: Point) => boolean) => {
    const index = line.points.findIndex(test);
    return index < 0 ? 0 : line.cumulative[index];
  };

  /* Where each fibre meets the bundle, measured along the line: the first just inside the edge, then one every
     `gapMs` of travel — evenly closer, if the line is too short to fit them before the cord must be whole. The
     leading fibre is the line itself. */
  const onScreen = arcWhere((p) => p.y >= view.top && p.x >= view.left);
  const pastEyebrow = arcWhere(
    (p) => p.x >= (eyebrow ? eyebrow.right : centreX) && p.y >= view.top,
  );
  /* Past the eyebrow the bundle mostly stops wiggling. */
  const calm = (p: number) => 1 - (1 - E.calm) * smooth((p - pastEyebrow) / 60);
  const firstJoin = onScreen + 35;

  /* The bundle starts a little slower than the draw and speeds up smoothly from the first join to the thread's
     start, where it is moving at the draw's own speed. `timeAt` is when its head reaches a point of the line,
     counted from the line's own start; `positionAt` is its inverse. */
  const speedAt = (p: number) =>
    startSpeed +
    (drawSpeed - startSpeed) *
      smooth((p - firstJoin) / Math.max(1, runLength - firstJoin));
  /* When the head reaches each whole pixel of the line, then the start itself — its last step is a part pixel, so
     the profile meets the draw exactly at the start rather than a pixel past it. */
  const whole = Math.floor(runLength);
  const reachedAt = [0];
  for (let p = 0; p < whole; p += 1)
    reachedAt.push(reachedAt[reachedAt.length - 1] + 1 / speedAt(p + 0.5));
  const atStart =
    reachedAt[whole] + (runLength - whole) / speedAt((whole + runLength) / 2);
  const timeAt = (p: number) => {
    if (p <= 0) return p / startSpeed;
    if (p >= runLength) return atStart + (p - runLength) / drawSpeed;
    if (p >= whole)
      return (
        reachedAt[whole] +
        ((p - whole) / (runLength - whole)) * (atStart - reachedAt[whole])
      );
    const at = Math.floor(p);
    return reachedAt[at] + (p - at) * (reachedAt[at + 1] - reachedAt[at]);
  };
  const positionAt = (time: number) => {
    if (time <= 0) return time * startSpeed;
    if (time >= atStart) return runLength + (time - atStart) * drawSpeed;
    if (time >= reachedAt[whole])
      return (
        whole +
        ((time - reachedAt[whole]) / (atStart - reachedAt[whole] || 1)) *
          (runLength - whole)
      );
    let lo = 0;
    let hi = whole;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (reachedAt[mid] <= time) lo = mid;
      else hi = mid;
    }
    return (
      lo +
      clamp01((time - reachedAt[lo]) / (reachedAt[hi] - reachedAt[lo] || 1))
    );
  };
  const latestJoin = runLength - length - zone * 0.5 - 20;
  const timed = [0, 1, 2, 3].map((order) =>
    positionAt(timeAt(firstJoin) + order * E.gapMs),
  );
  const joins = [
    0,
    ...(timed[3] <= latestJoin
      ? timed
      : [0, 1, 2, 3].map(
          (order) =>
            firstJoin + (order * Math.max(60, latestJoin - firstJoin)) / 3,
        )),
  ];

  /* Every joining fibre flows in from the top-left (the owner's limits: the left third of the top edge, the top
     two thirds of the left edge), each from its own stretch of those edges, alternating top and left. */
  const corner = topSpan / (topSpan + leftSpan);
  const entryAt = [
    corner * (0.35 + random() * 0.15),
    corner + (1 - corner) * (0.08 + random() * 0.12),
    corner * (0.8 + random() * 0.15),
    corner + (1 - corner) * (0.45 + random() * 0.3),
  ];
  const lanes = [0, 0.8, -0.8, 1, -1];
  const fibres = joins.map((joinAt, index) => {
    const lane = lanes[index] * E.spread;
    let approach: Track | null = null;
    let joinNormal = { x: 0, y: 0 };
    if (index > 0) {
      /* A joining fibre arrives moving along the line, so it turns into its join point from behind. */
      const at = along(line, joinAt);
      joinNormal = { x: at.nx, y: at.ny };
      const landing = { x: at.x + at.nx * lane, y: at.y + at.ny * lane };
      const from = topLeftEdge(entryAt[index - 1], view, E.outside);
      const distance = Math.hypot(landing.x - from.x, landing.y - from.y) || 1;
      const inward = {
        x: (landing.x - from.x) / distance,
        y: (landing.y - from.y) / distance,
      };
      const across = { x: -inward.y, y: inward.x };
      const firstBend = E.curve * (random() * 2 - 1);
      const behind = Math.max(
        18,
        Math.min(
          distance * 0.4,
          reach(landing, { x: -at.tx, y: -at.ty }, view) - 12,
        ),
      );
      approach = track(
        cubic(
          from,
          {
            x: from.x + inward.x * distance * 0.35 + across.x * firstBend,
            y: from.y + inward.y * distance * 0.35 + across.y * firstBend,
          },
          { x: landing.x - at.tx * behind, y: landing.y - at.ty * behind },
          landing,
          120,
        ),
      );
    }
    return {
      lane,
      joinAt,
      approach,
      approachLength: approach ? approach.length : 0,
      joinNormal,
      wiggle: makeWiggle(random),
      pitch: E.pitch * (0.8 + random() * 0.4),
      pitchPhase: random() * TAU,
      reachPhase: random() * TAU,
      twistPhase: (index / E.fibres) * TAU + (random() - 0.5) * 0.9,
      roll: 0.75 + random() * 0.5,
    };
  });
  /* Where each joining fibre counts as closed into the bundle. */
  const closes = joins.slice(1).map((joinAt) => joinAt + zone * 0.5);
  const widths = ([2, 3, 4] as const).map((closed) =>
    coreWidth(closed, E.fibreWidth, input.cordWidth),
  );

  /* The bundle's head moves along the line from the moment the first fibre sets off beyond the edge — each fibre
     travels with it, timed to meet the head at its join point — and passes the thread's start at the draw's own
     speed, where the real draw takes over; its far end then slows into place behind the line drawing on. */
  const first = Math.min(
    0,
    ...fibres.map((fibre) => fibre.joinAt - fibre.approachLength),
  );
  const setOff = timeAt(first);
  const passesStart = atStart - setOff;
  const headAt = (t: number) => positionAt(setOff + Math.max(0, t));
  const settleTime = (2 * length) / drawSpeed;
  const tailAt = (t: number) =>
    t < passesStart
      ? Math.max(0, headAt(t) - length)
      : runLength - length * (1 - clamp01((t - passesStart) / settleTime)) ** 2;
  const land = passesStart + settleTime;
  /* Released a frame early: the draw starts on the animation frame after its timer fires. */
  const release = passesStart - 16;
  const bundleWiggle = makeWiggle(random);

  const frame = (elapsed: number, drawn: number): EntranceFrame => {
    const tail = tailAt(elapsed);
    const head = Math.min(headAt(elapsed), tail + length);
    const whole = smooth((tail - closes[3]) / zone);
    const done = tail >= closes[3] + zone * 0.5;
    const roll = (E.turnsPerSecond * TAU * elapsed) / 1000;
    /* The joined bundle wiggles with its own wandering wiggle from the first join on; it mostly settles past the
       eyebrow, and lies flat before the start, where the real thread takes over. */
    const swing =
      E.bundleWiggle *
      smooth(elapsed / 600) *
      (1 - smooth((elapsed - (passesStart - 600)) / 500));
    const sway = (p: number) =>
      swing *
      smooth((p - joins[1]) / 40) *
      smooth((runLength - p) / 80) *
      calm(p) *
      bundleWiggle(p, elapsed);
    const onLine = (p: number, shift: number) => {
      const l = along(line, p);
      return { x: l.x + l.nx * shift, y: l.y + l.ny * shift };
    };

    const fibrePoints = fibres.map((fibre, index) => {
      const reached = head - fibre.joinAt + fibre.approachLength;
      if (reached <= 0 || done) return null;
      /* Each joining fibre twists in over the distance it travels after joining, rolling round the bundle as it
         closes; the leading fibre rolls round the first to join it. The helix is measured back from the head, so
         it travels with the bundle, and wanders in pitch and reach so no two turns match. */
      const helix = (p: number) => {
        const a = p - head;
        const turn =
          TAU *
            (a / fibre.pitch +
              0.18 *
                Math.sin((TAU * a) / (fibre.pitch * 3.7) + fibre.pitchPhase)) +
          fibre.twistPhase +
          roll * fibre.roll;
        return (
          E.spread *
          (0.75 + 0.25 * Math.sin((TAU * a) / 57 + fibre.reachPhase)) *
          Math.sin(turn)
        );
      };
      const joined = index === 0 ? joins[1] : fibre.joinAt;
      const offset = (p: number) => {
        if (p < joined) return 0;
        const d = p - joined;
        const rolling = smoother(d / (0.4 * zone));
        return (
          (1 - smoother(d / zone)) *
          ((1 - rolling) * fibre.lane + rolling * helix(p))
        );
      };
      /* A fibre wiggles on its own while it is loose — coming in, and until it has twisted in. */
      const looseness = (p: number) => {
        if (p < joined) return index === 0 ? 1 : 0;
        const d = p - joined;
        return (1 - smoother(d / zone)) * (index === 0 ? 1 : smooth(d / 30));
      };
      const points: Point[] = [];
      for (let u = Math.max(0, reached - length); u <= reached + 0.01; u += 2) {
        if (fibre.approach && u < fibre.approachLength) {
          const b = along(fibre.approach, u);
          const toJoin = fibre.approachLength - u;
          const w =
            E.fibreWiggle * smooth(toJoin / 40) * fibre.wiggle(u, elapsed);
          /* Over its last stretch it meets the bundle's sway at the join point. */
          const meet = sway(fibre.joinAt) * smooth(1 - toJoin / 40);
          points.push({
            x: b.x + b.nx * w + fibre.joinNormal.x * meet,
            y: b.y + b.ny * w + fibre.joinNormal.y * meet,
          });
          continue;
        }
        const p = fibre.joinAt + (u - fibre.approachLength);
        points.push(
          onLine(
            p,
            offset(p) +
              sway(p) +
              0.5 *
                E.fibreWiggle *
                looseness(p) *
                calm(p) *
                fibre.wiggle(u, elapsed),
          ),
        );
      }
      return points.length > 1 ? points : null;
    });

    const span = (from: number, to: number) => {
      const points: Point[] = [];
      for (let p = from; p <= to + 0.01; p += 1.5)
        points.push(onLine(p, sway(p)));
      return points;
    };
    const cores: EntranceFrame["cores"] = [];
    if (!done)
      for (let closed = 2; closed <= 4; closed++) {
        const from = Math.max(tail, closes[closed - 2]);
        const to = Math.min(head, closes[closed - 1]);
        if (to - from > 0.5)
          cores.push({ width: widths[closed - 2], points: span(from, to) });
      }

    /* The cord shows where all five are closed. Once the real thread is drawing, the cord leaves its ink, drawing
       head and all, uncovered, so nothing is drawn twice. */
    const from = Math.max(closes[3], tail + frayLength * whole);
    const inkFrom = runLength + frayLength;
    const inkTo = runLength + drawn;
    const spans: [number, number][] =
      inkTo > inkFrom
        ? [
            [from, Math.min(head, inkFrom)],
            [Math.max(from, inkTo), head],
          ]
        : [[from, head]];
    const cord = spans
      .filter(([a, b]) => b - a > 0.5)
      .map(([a, b]) => span(a, b));

    const cut = along(line, tail + frayLength);
    return {
      fibres: fibrePoints,
      cores,
      cord,
      tail: { x: cut.x, y: cut.y, angle: Math.atan2(-cut.ty, -cut.tx) },
      frayOpacity: whole,
    };
  };

  return {
    release,
    land,
    frame,
    joinTimes: joins.slice(1).map((joinAt) => timeAt(joinAt) - setOff),
    headAt,
    startArc: runLength,
    line: line.points,
  };
}
