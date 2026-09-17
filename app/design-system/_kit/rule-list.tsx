interface RuleListProps {
  /** Category label, rendered as an eyebrow. Omitted for a section's single unlabelled list. */
  label?: string;
  rules: string[];
}

export function RuleList({ label, rules }: RuleListProps) {
  return (
    <div className="flex flex-col gap-space-2xs">
      {label === undefined ? null : (
        <span className="type-eyebrow">{label}</span>
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
