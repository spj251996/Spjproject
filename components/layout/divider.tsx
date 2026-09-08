/* DESIGN.md → Foundations → Layout → `divider`.

   `<hr>` carries the separator role natively and the framework's preflight already gives it a
   top-only border, so this sets the two values the doc states and nothing else. */

interface DividerProps {
  className?: string;
}

export function Divider({ className }: DividerProps) {
  return (
    <hr
      className={`border-t-(length:--stroke-divider) border-accent-gold-on-base ${className ?? ""}`}
    />
  );
}
