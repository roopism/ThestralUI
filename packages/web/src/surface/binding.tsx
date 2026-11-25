import { type BlockProps, classes } from "../_shared/primitives/binding.js";
export function Surface({ className, ...props }: BlockProps) {
  return <div {...props} className={classes('uld-surface', className)} />;
}
