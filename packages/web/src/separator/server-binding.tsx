import type { ComponentProps } from 'react';
import { Divider } from './binding.js';

export function Separator({ orientation = 'horizontal', ...props }: ComponentProps<'hr'> & { orientation?: 'horizontal' | 'vertical' }) {
  return <Divider aria-orientation={orientation} {...props} />;
}
