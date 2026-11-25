import { afterEach, expect, expectTypeOf, test } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { createRef, type ComponentProps } from 'react';
import { Inline, Stack } from '../packages/web/src/primitives';

afterEach(cleanup);

test('layout token and distribution contracts preserve the host, class and ref', () => {
  type Props = ComponentProps<typeof Stack>;
  type Space = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  expectTypeOf<Props['gap']>().toEqualTypeOf<Space | { base: Space; wide: Space } | undefined>();
  expectTypeOf<'wrap'>().not.toMatchTypeOf<keyof Props>();
  expectTypeOf<ComponentProps<typeof Inline>['wrap']>().toEqualTypeOf<boolean | undefined>();
  const ref = createRef<HTMLDivElement>();
  render(
    <Stack
      ref={ref}
      role="group"
      aria-label="Actions"
      className="custom"
      gap={{ base: 'xs', wide: 'xl' }}
    >
      <Inline align="end" justify="space-between" wrap={false}>
        <button>Continue</button>
      </Inline>
    </Stack>,
  );
  const host = screen.getByRole('group', { name: 'Actions' });
  expect(ref.current).toBe(host);
  expect(host.classList.contains('custom')).toBe(true);
  expect(host.hasAttribute('gap')).toBe(false);
  expect(host.hasAttribute('widegap')).toBe(false);
  expect(host.firstElementChild?.firstElementChild).toBe(screen.getByRole('button'));
});
