import { type ComponentProps } from "react";
import { classes } from "../_shared/primitives/binding.js";
export function PanelHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div {...props} className={classes('uld-panel-header', className)} />;
}
