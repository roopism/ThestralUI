import { type ReactNode } from "react";
export function Icon({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {children}
    </span>
  );
}
