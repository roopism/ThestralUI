import { type ComponentProps } from "react";
export function Progress({ label, ...props }: ComponentProps<'progress'> & { label: string }) {
  return <progress {...props} aria-label={label} />;
}
