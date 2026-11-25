import type { ComponentProps } from 'react';

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export function Heading({ level = 3, ...props }: ComponentProps<'h3'> & { level?: HeadingLevel }) {
  const Element = `h${level}` as const;
  return <Element {...props} />;
}
