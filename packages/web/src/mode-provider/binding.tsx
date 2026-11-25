import type { HTMLAttributes, Ref } from 'react';
import type { ModeSelection } from '@ui-lazy-dev/tokens/modes';

export type ModeProviderProps = HTMLAttributes<HTMLDivElement> & ModeSelection & {
  ref?: Ref<HTMLDivElement>;
};

export function ModeProvider({
  brand, scheme, density, motion, mode, children, ...host
}: ModeProviderProps) {
  return <div {...host} data-uld-brand={brand} data-uld-scheme={scheme}
    data-uld-density={density} data-uld-motion={motion} data-uld-mode={mode}>{children}</div>;
}
