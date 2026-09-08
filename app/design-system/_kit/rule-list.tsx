/* curate-gallery scaffold kit — RuleList.

   Was triplicated byte-identically across `_sections/foundations.tsx`, `_sections/background.tsx`,
   and `_sections/components.tsx` under the mistaken belief that the pinned `sections/` file count
   (exactly 5 files) forbids a sixth module. That pin is scoped to `sections/` only; `_kit/` is the
   separate folder architecture.md's generic/instance split puts zero-project-specific helpers in.
   Extracted here, unchanged, per that split. */

interface RuleListProps {
  /** Category label, rendered as an eyebrow. Omitted for a section's single unlabelled list. */
  label?: string;
  rules: string[];
}

export function RuleList({ label, rules }: RuleListProps) {
  return (
    <div className="flex flex-col gap-space-2xs">
      {label === undefined ? null : (
        <span className="type-eyebrow text-accent-gold-on-base">{label}</span>
      )}
      <ul className="flex flex-col gap-space-2xs">
        {rules.map((rule) => (
          <li className="type-body text-ink" key={rule}>
            {rule}
          </li>
        ))}
      </ul>
    </div>
  );
}
