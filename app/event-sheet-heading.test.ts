import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/* `date-primary` and `heading-lg` share a size at every tier (DESIGN.md → Foundations →
   Typography), so WEIGHT is the only thing telling the event sheet's date and address apart. That
   makes the pair a silent failure mode: either utility can be moved, added or dropped and the
   layout, the build, the types and every other test stay green while the two lines swap meaning.
   The owner inverted them on 2026-10-07 so the sheet reads as the invite does; this pins which line
   carries the weight. */

const source = readFileSync("app/page.tsx", "utf8");

/* Bounded by the next top-level `function`, which is how the sibling page-source tests slice this
   file. The length assertion is the guard: a slice that silently ran away or came back empty would
   let every assertion below pass against the wrong text. */
function eventSheetHeading(): string {
  const start = source.indexOf("function EventSheetHeading");
  assert.notStrictEqual(start, -1, "no EventSheetHeading in app/page.tsx");
  const rest = source.slice(start + 1);
  const end = rest.indexOf("\nfunction ");
  const body = end === -1 ? rest : rest.slice(0, end);
  assert.ok(
    body.length > 200 && body.length < 2000,
    `EventSheetHeading slice is ${body.length} chars — the slice is wrong, not the code`,
  );
  return body;
}

/* The element's whole className, so an assertion cannot pass on a class that sits on a sibling. */
function classOf(body: string, tag: string): string {
  const at = body.indexOf(tag);
  assert.notStrictEqual(at, -1, `no ${tag} in EventSheetHeading`);
  const match = /className="([^"]*)"/.exec(body.slice(at));
  assert.notStrictEqual(match, null, `${tag} carries no className`);
  return (match as RegExpExecArray)[1];
}

test("the event sheet's date carries the weight, with no utility stepping it down", () => {
  const body = eventSheetHeading();
  const date = classOf(body, '<p className="type-date-primary');
  assert.match(date, /\btype-date-primary\b/);
  /* `date-primary` is 700 in its own right, so the date is correct by carrying NO weight utility.
     Tailwind's `font-*` are the only things that can override it from here. */
  assert.doesNotMatch(
    date,
    /\bfont-(thin|extralight|light|normal|medium|semibold)\b/,
    `the date must not step its own weight down: "${date}"`,
  );
});

test("the event sheet's address steps back to 500", () => {
  const body = eventSheetHeading();
  const address = classOf(body, "<address");
  assert.match(address, /\btype-heading-lg\b/);
  assert.match(
    address,
    /\bfont-medium\b/,
    `the address must step back from heading-lg's 700: "${address}"`,
  );
});

/* Libre Baskerville has no 500 cut, but these two lines are `--font-serif` (Playfair Display),
   which is a variable 400-900 axis — so `font-medium` here is a real face and not the no-op it
   would be on the sans. Measured on a render, 2026-10-07. If the serif ever stops being variable,
   this test keeps passing while the design silently collapses to one weight, so the family is
   asserted too. */
test("the two lines are set in the variable serif, where 500 is a real cut", () => {
  const typeScale = readFileSync("app/styles/type-scale.css", "utf8");
  for (const role of ["type-date-primary", "type-heading-lg"]) {
    const at = typeScale.indexOf(`.${role} {`);
    assert.notStrictEqual(at, -1, `no .${role} in type-scale.css`);
    const rule = typeScale.slice(at, typeScale.indexOf("}", at));
    assert.match(
      rule,
      /font-family:\s*var\(--font-serif\)/,
      `.${role} must stay on the serif for a 500 to exist`,
    );
  }
});
