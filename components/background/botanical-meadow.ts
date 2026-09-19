/* The meadow band's own natural width/height, read from the shipped compact/laptop-tier files
   (1500×377 — `public/botanical/meadow-band-{compact,laptop}.avif`). Split into its own plain
   module, rather than living in `botanical.tsx`, so `botanical.test.ts` can import it without also
   parsing that file's JSX — `node --test` runs `.ts` files directly but does not compile `.tsx`.
   `botanical.test.ts` re-reads every shipped tier's file with `sharp` and asserts this still
   matches, so a regenerated file that changes the crop fails a test instead of silently mis-cropping
   the page. */
export const MEADOW_NATURAL_WIDTH = 1500;
export const MEADOW_NATURAL_HEIGHT = 377;

/* How much of the natural height shows before the bottom edge crops it — a starting value, not a
   measured one; tuned live with the owner in Wave 3. */
export const MEADOW_VISIBLE_FRACTION = 0.55;
