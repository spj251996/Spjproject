/* `<hr>` carries the separator role natively, and preflight already gives it a top-only border. */

interface DividerProps {
  className?: string;
}

export function Divider({ className }: DividerProps) {
  return (
    <hr
      className={`border-t-(length:--stroke-divider) border-accent-gold ${className ?? ""}`}
    />
  );
}
