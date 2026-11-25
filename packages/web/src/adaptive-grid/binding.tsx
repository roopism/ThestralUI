import { type HTMLAttributes } from "react";
/** Flows from a single column into as many readable columns as the parent permits. */
export function AdaptiveGrid({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={['uld-adaptive-grid', className].filter(Boolean).join(' ')}
    />
  );
}
