# Legacy static-HTML site (archived)

This is the last live version of the wedding invitation site before the Next.js rewrite —
a self-contained static `index.html` with inline styles, no build step.

- `index.html`, `hero-bg.jpg`, `hero-bg-mobile.jpg`, `og-preview.jpg` — the production site as it shipped.
- `design-system/` — a dev-only component gallery reverse-engineered from `index.html` for design reference;
  never part of production, never deployed.

Reference-only. Not served, not part of the current build. For full history prior to the move, see
`git log --follow legacy-html/index.html`.
