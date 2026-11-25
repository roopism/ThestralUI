'use client';
import { type ComponentProps, type ReactNode, useId } from "react";
import { classes } from "../_shared/primitives/binding.js";
import { Button } from "../button/binding.js";
export type ResourceCardProps = Omit<ComponentProps<'article'>, 'title' | 'children'> & {
  title: string;
  metadata?: ReactNode;
  artwork?: ReactNode;
  bodyClassName?: string;
  selected: boolean;
  onSelectedChange: (selected: boolean) => void;
  actionLabel: string;
  actionText: string;
  headingLevel?: 2 | 3 | 4;
};
export function ResourceCard({
  title,
  metadata,
  artwork,
  bodyClassName,
  selected,
  onSelectedChange,
  actionLabel,
  actionText,
  headingLevel = 2,
  className,
  ...article
}: ResourceCardProps) {
  const titleId = useId();
  const Heading = (['h2', 'h3', 'h4'] as const)[headingLevel - 2];
  return (
    <article
      {...article}
      className={classes('uld-resource-card', className)}
      aria-labelledby={titleId}
    >
      {artwork}
      <div className={bodyClassName}>
        {metadata && <p>{metadata}</p>}
        <Heading id={titleId}>{title}</Heading>
        <Button
          motion="press"
          aria-label={actionLabel}
          aria-pressed={selected}
          onClick={() => onSelectedChange(!selected)}
        >
          {actionText}
        </Button>
      </div>
    </article>
  );
}
