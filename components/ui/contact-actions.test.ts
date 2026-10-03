import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/* Comments are stripped so the assertions read the code alone — this file's own comments name the
   classes under test. */
const strip = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "");
const page = strip(readFileSync("app/page.tsx", "utf8"));
const button = strip(readFileSync("components/ui/button-action.tsx", "utf8"));

function contactPlate() {
  const start = page.indexOf("function ContactPlate");
  assert.notStrictEqual(start, -1, "no ContactPlate found");
  const body = page.slice(start + 1);
  const end = body.indexOf("\nfunction ");
  return end === -1 ? body : body.slice(0, end);
}

/* The alignment has to be switchable INSIDE the component: the disc lives in a span the call site
   cannot reach, and two utilities setting the same property resolve by stylesheet order rather than
   by the order they are written, so a `justify-start` passed through `className` is not reliable. */
test("ButtonAction can align its content to the start", () => {
  /* The prop's TYPE is deliberately not pinned to a literal union: it derives from the lookup, so
     the two names exist in one place only. What matters is that the prop exists and that both
     justifications are reachable through a single map — which is what makes exactly one of them
     reach the element. */
  assert.match(button, /align\??:/);
  assert.match(button, /center:\s*"justify-center"/);
  /* `w-full` is pinned, not loosely matched. The target is `justify-center`, so without it the span
     is content-sized and centred inside a stretched target and the discs stay 19.65px apart — i.e.
     dropping `w-full` reinstates the whole defect while leaving `justify-start` in place. */
  assert.match(button, /stretchStart:\s*"w-full\s+justify-start"/);
  /* The span must actually CONSUME the lookup. Without this, deleting `${ALIGN[align]}` from the
     className ships no justification at all and every other assertion here still passes. */
  assert.match(button, /\$\{markClassName\}\s+\$\{ALIGN\[align\]\}/);
  /* `markClassName` must no longer carry its own justification, or the lookup is fighting it. */
  const mark = button.slice(button.indexOf("const markClassName"));
  assert.doesNotMatch(mark.slice(0, mark.indexOf("].join")), /justify-/);
});

/* The gallery is the visual companion to DESIGN.md, so a specimen that renders the defect under a
   caption claiming it is fixed is worse than no specimen. It must carry the same construction as
   `ContactPlate`, not merely describe it. */
test("the gallery's contact-actions specimen matches the real pair", () => {
  /* Read RAW, not stripped: this file carries a `/*` inside a string attribute, and a naive
     comment-stripper pairs that with the next `*​/` and swallows the specimen whole. Safe to read
     raw because the search is bounded to the specimen's own slice below. */
  const gallery = readFileSync(
    "app/design-system/_sections/components.tsx",
    "utf8",
  );
  const from = gallery.indexOf("A contact's actions");
  assert.notStrictEqual(from, -1, "no contact-actions specimen in the gallery");
  const specimen = gallery.slice(from, gallery.indexOf("</Variant>", from));
  assert.match(specimen, /items-stretch/);
  assert.match(specimen, /w-fit/);
  assert.equal(
    (specimen.match(/align="stretchStart"/g) ?? []).length,
    2,
    "both specimen actions must align to the start, as ContactPlate's do",
  );
});

/* The default must stay centred, or the map action and the gallery modal's close button move. */
test("ButtonAction still centres by default", () => {
  assert.match(button, /align\s*=\s*"center"/);
});

/* Both actions must take it, or the pair keeps centring each row independently and the discs land
   ~20px apart — which is what made it read as a ragged bulleted list (couple, 2026-10-02). */
test("both contact actions align to the start", () => {
  const actions = contactPlate().match(/<ButtonAction[\s\S]*?>/g) ?? [];
  assert.equal(
    actions.length,
    2,
    `expected exactly two actions in a contact plate, found ${actions.length}`,
  );
  for (const action of actions) assert.match(action, /align="stretchStart"/);
});

/* The class list cannot be bounded by the next `>`: an arbitrary variant contains one
   (`[@media(width>=64rem)...]`), so that slice stops mid-attribute. Take the quoted value. */
function actionWrapperClasses() {
  const plate = contactPlate();
  const from = plate.indexOf("mt-space-sm");
  assert.notStrictEqual(from, -1, "no action wrapper found in ContactPlate");
  const quoted = plate.slice(plate.lastIndexOf('"', from) + 1);
  return quoted.slice(0, quoted.indexOf('"'));
}

/* Sharing a left edge needs the two targets to share a WIDTH; without stretching, each shrinks to
   its own label and the discs separate again however they are justified. */
test("the contact action pair shares one width", () => {
  const classes = actionWrapperClasses();
  assert.match(classes, /items-stretch/);
  assert.match(classes, /w-fit/);
});

/* The pair must not gain height: Contact already overflows one screen at 375x667. */
test("the contact action pair stays flush", () => {
  assert.match(actionWrapperClasses(), /gap-0/);
});
