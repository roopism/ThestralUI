import { type ComponentProps, type ReactNode } from "react";
import { classes } from "../_shared/primitives/binding.js";
export type EmptyStateProps = Omit<ComponentProps<'div'>, 'title' | 'children'> & {
  title: string;
  description?: ReactNode;
  illustration?: ReactNode;
  action?: ReactNode;
  headingLevel?: 2 | 3 | 4;
};
export function EmptyState({
  title,
  description,
  illustration,
  action,
  headingLevel = 2,
  className,
  ...props
}: EmptyStateProps) {
  const Heading = (['h2', 'h3', 'h4'] as const)[headingLevel - 2];
  return (
    <div {...props} className={classes('uld-empty-state', className)}>
      {illustration}
      <Heading>{title}</Heading>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
