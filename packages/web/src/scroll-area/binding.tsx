import { type BlockProps, classes } from "../_shared/primitives/binding.js";
export function ScrollArea({ label, className, ...props }: BlockProps & { label: string }) {
  return (
    <div
      {...props}
      role="region"
      aria-label={label}
      tabIndex={0}
      className={classes('uld-scroll', className)}
    />
  );
}
