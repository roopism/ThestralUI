import { type ComponentProps } from "react";
import { classes } from "../_shared/primitives/binding.js";
/** The host owns the actual viewer, request lifecycle, printing and export operations. */
export function DocumentPreview({
  label,
  className,
  ...section
}: ComponentProps<'section'> & { label: string }) {
  return (
    <section
      {...section}
      className={classes('uld-document-preview', className)}
      aria-label={label}
    />
  );
}
