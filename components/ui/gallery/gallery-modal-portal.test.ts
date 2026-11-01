import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/* The modal renders from `photo-row`, inside Celebrations' card, whose frame box is `position: relative;
   z-index: var(--z-content)` — a stacking context at 20. Inline, the modal's own `--z-modal` counted
   only inside it, so the scroll progress bar at the root (`--z-progress`, 45) painted its line across
   the open viewer: measured, 786 of the top three rows' 1,179 pixels bar-coloured. Portalled to
   `<body>`, the modal stacks in the root context, where 50 is above 45. */
test("the gallery modal portals to <body>, out of the card's stacking context", () => {
  const source = readFileSync(
    "components/ui/gallery/gallery-modal.tsx",
    "utf8",
  );
  assert.match(source, /import \{ createPortal \} from "react-dom";/);
  assert.match(source, /return createPortal\(/);
  assert.match(source, /,\s*document\.body,?\s*\);\s*\}\s*$/);
});
