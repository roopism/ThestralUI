import { type ComponentProps } from "react";
import { classes } from "../_shared/primitives/binding.js";
export function Badge({ className, ...props }: ComponentProps<'span'>) {
  return <span {...props} className={classes('uld-badge', className)} />;
}
