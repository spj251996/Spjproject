import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { flatten, parseSway, parseTwist } from "./thread-spikes.ts";
import {
  THREAD_VARIANT_AXES,
  THREAD_VARIANT_STORAGE_KEY,
  type VariantAxis,
  variantBootScript,
} from "./thread-variant.ts";

const AXES: readonly VariantAxis[] = [
  {
    id: "shadow",
    label: "Shadow",
    options: [
      { id: "tight", label: "Tight", properties: { "--bleed-thread": "x" } },
      { id: "soft", label: "Soft" },
      {
        id: "wide",
        label: "Wide",
        css: "@media (width >= 64rem){:root{--x:1px}}",
      },
    ],
  },
];

/* Runs the boot script against a stand-in `<html>` and storage, and returns what it wrote. */
function boot(stored: string | null, options: { throws?: boolean } = {}) {
  const attributes = new Map<string, string>();
  const properties = new Map<string, string>();
  const localStorage = {
    getItem(key: string) {
      if (options.throws) throw new Error("storage blocked");
      return key === THREAD_VARIANT_STORAGE_KEY ? stored : null;
    },
  };
  const documentElement = {
    setAttribute: (name: string, value: string) => attributes.set(name, value),
    style: {
      setProperty: (name: string, value: string) => properties.set(name, value),
    },
  };
  const sheets: string[] = [];
  const head = {
    appendChild: (sheet: { textContent: string }) =>
      sheets.push(sheet.textContent),
  };
  const createElement = () => ({ setAttribute() {}, textContent: "" });
  runInNewContext(variantBootScript(AXES), {
    localStorage,
    document: { documentElement, head, createElement },
  });
  return {
    attributes: Object.fromEntries(attributes),
    properties: Object.fromEntries(properties),
    ...(sheets.length > 0 ? { sheets } : {}),
  };
}

test("with nothing stored the boot script writes nothing", () => {
  assert.deepEqual(boot(null), { attributes: {}, properties: {} });
});

test("a stored option sets its attribute and its properties", () => {
  assert.deepEqual(boot(JSON.stringify({ shadow: "tight" })), {
    attributes: { "data-thread-variant-shadow": "tight" },
    properties: { "--bleed-thread": "x" },
  });
});

test("an option with no properties still sets its attribute", () => {
  assert.deepEqual(boot(JSON.stringify({ shadow: "soft" })), {
    attributes: { "data-thread-variant-shadow": "soft" },
    properties: {},
  });
});

test("an unknown axis or option is ignored, so storage cannot paint what the panel does not offer", () => {
  assert.deepEqual(boot(JSON.stringify({ shadow: "gone", sway: "on" })), {
    attributes: {},
    properties: {},
  });
});

test("blocked storage and malformed JSON both leave the shipped thread", () => {
  assert.deepEqual(boot(null, { throws: true }), {
    attributes: {},
    properties: {},
  });
  assert.deepEqual(boot("{not json"), { attributes: {}, properties: {} });
  assert.deepEqual(boot("null"), { attributes: {}, properties: {} });
});

test("every axis offers distinct option ids, none of them the shipped value", () => {
  for (const axis of THREAD_VARIANT_AXES) {
    const ids = axis.options.map((option) => option.id);
    assert.equal(
      new Set(ids).size,
      ids.length,
      `${axis.id} repeats an option id`,
    );
    assert.ok(
      !ids.includes("shipped"),
      `${axis.id} offers the shipped value as an option`,
    );
  }
});

/* The sway option ids carry their own values, so an id the parser cannot read would offer a
   candidate that paints nothing. */
test("every sway option id parses to its amplitude, periods and mix", () => {
  const sway = THREAD_VARIANT_AXES.find((axis) => axis.id === "sway");
  assert.ok(sway !== undefined, "the panel offers no sway axis");
  for (const option of sway.options) {
    const parsed = parseSway(option.id);
    assert.ok(parsed !== undefined, `${option.id} does not parse`);
    assert.ok(parsed.amplitude > 0, `${option.id} parses to nothing`);
  }
  assert.equal(parseSway(undefined), undefined);
  assert.deepEqual(parseSway("sg-8-p7-e5-g30"), {
    amplitude: 8,
    swayPeriod: 7,
    gustEvery: 5,
    gustShare: 0.3,
  });
  assert.equal(parseSway("sway+gust-8"), undefined);
});

test("an option with a stylesheet adds it, so a value can follow a media query", () => {
  assert.deepEqual(boot(JSON.stringify({ shadow: "wide" })), {
    attributes: { "data-thread-variant-shadow": "wide" },
    properties: {},
    sheets: ["@media (width >= 64rem){:root{--x:1px}}"],
  });
});

test("every twist option id parses to a rope shape", () => {
  const twist = THREAD_VARIANT_AXES.find((axis) => axis.id === "twist");
  assert.ok(twist !== undefined, "the panel offers no twist axis");
  for (const option of twist.options) {
    const parsed = parseTwist(option.id);
    assert.ok(parsed !== undefined, `${option.id} does not parse`);
    assert.ok(parsed.kind === "rope", `${option.id} is not a rope`);
  }
  assert.deepEqual(parseTwist("s4.5-clear"), { kind: "ticks", spacing: 4.5 });
  assert.deepEqual(parseTwist("long-loose"), {
    kind: "rope",
    shape: { pitch: 2.5, gap: 0.2, slant: 22, bow: 0.18, lighter: 0.18 },
  });
  assert.equal(parseTwist("braid-8"), undefined);
  assert.equal(parseTwist("s4.5-soft"), undefined);
});

/* The sway moves points, so a cubic it moved only at its control points could not follow the field
   between them the way the 1px re-trace laid on it does. Flattened, both are polylines. */
test("a cubic flattens into short chords that start and end where the curve does", () => {
  const flat = flatten("M0 0C0 10 10 10 10 0L20 0");
  assert.ok(flat.startsWith("M0.00 0.00L"), flat);
  assert.ok(flat.endsWith("L10.00 0.00L20.00 0.00"), flat);
  assert.doesNotMatch(flat, /C/);
  const points = flat.match(/-?\d+\.\d+ -?\d+\.\d+/g) ?? [];
  assert.ok(
    points.length >= 10,
    `a 30px curve took only ${points.length} points`,
  );
  assert.equal(flatten("M1 2L3 4 5 6"), "M1.00 2.00L3.00 4.00L5.00 6.00");
});
