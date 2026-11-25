import { type ComponentProps } from "react";
import { type InlineProps } from "../../inline/binding.js";
export function classes(base: string, extra?: string) {
  return extra ? base + ' ' + extra : base;
}
export type BlockProps = ComponentProps<'div'>;
export type LayoutSpace = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export function layout(name: string, { className, gap, align, justify, wrap, ...props }: InlineProps) {
  return (
    <div
      {...props}
      className={classes(name, className)}
      data-uld-gap={typeof gap === 'string' ? gap : gap?.base}
      data-uld-wide-gap={typeof gap === 'object' ? gap?.wide : undefined}
      data-uld-align={align}
      data-uld-justify={justify}
      data-uld-nowrap={wrap === false ? '' : undefined}
    />
  );
}
