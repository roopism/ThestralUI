import { createRef } from 'react';

import { afterEach, expect, test } from 'vitest';

import { cleanup, render, screen } from '@testing-library/react';

import { Heading } from '@ui-lazy-dev/ui-web/navigation';

afterEach(cleanup);

test('an exported heading uses the requested outline level and forwards its ref', () => {
  const ref = createRef<HTMLHeadingElement>();
  const view = render(<Heading ref={ref}>Review</Heading>);
  expect(screen.getByRole('heading', { level: 3, name: 'Review' })).toBe(ref.current);
  view.rerender(
    <Heading level={2} ref={ref}>
      Overview
    </Heading>,
  );
  expect(screen.getByRole('heading', { level: 2, name: 'Overview' })).toBe(ref.current);
});
