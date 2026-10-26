import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
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
  runInNewContext(variantBootScript(AXES), {
    localStorage,
    document: { documentElement },
  });
  return {
    attributes: Object.fromEntries(attributes),
    properties: Object.fromEntries(properties),
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

test("the shipped panel offers no axes until a round adds them", () => {
  assert.deepEqual(THREAD_VARIANT_AXES, []);
});
