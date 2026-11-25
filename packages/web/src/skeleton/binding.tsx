import { type BlockProps, classes } from "../_shared/primitives/binding.js";
export function Skeleton({ className, ...props }: BlockProps) {
  return <div {...props} aria-hidden="true" className={classes('uld-skeleton', className)} />;
}
