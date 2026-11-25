import { afterEach, expect, test } from 'vitest';

import { cleanup, render, screen } from '@testing-library/react';

import { createRef } from 'react';

import { Badge, Box, Divider, ScrollArea, Surface, Text } from '@ui-lazy-dev/ui-web/primitives';

afterEach(cleanup);

test('neutral layout and text preserve the requested host refs, reading direction and content', () => {
  const outer = createRef<HTMLDivElement>();
  const text = createRef<HTMLSpanElement>();
  render(
    <Box ref={outer} lang="ar" dir="rtl">
      <Text ref={text}>قيد المراجعة</Text>
    </Box>,
  );
  expect(outer.current?.tagName).toBe('DIV');
  expect(outer.current?.dir).toBe('rtl');
  expect(text.current).toBe(screen.getByText('قيد المراجعة'));
  expect(text.current?.tagName).toBe('SPAN');
  expect(text.current?.tabIndex).toBe(-1);
});

test('a surface and badge add style hooks without injecting a region or live announcement', () => {
  render(
    <Surface className="summary">
      <Badge className="priority">Due today</Badge>
    </Surface>,
  );
  const badge = screen.getByText('Due today');
  expect(badge.classList.contains('uld-badge')).toBe(true);
  expect(badge.classList.contains('priority')).toBe(true);
  expect(badge.parentElement?.classList.contains('uld-surface')).toBe(true);
  expect(badge.parentElement?.classList.contains('summary')).toBe(true);
  expect(screen.queryByRole('status')).toBeNull();
  expect(screen.queryByRole('region')).toBeNull();
});

test('a divider exposes the host separator and a named scroll region can receive focus', () => {
  render(
    <ScrollArea label="Audit trail">
      <Divider />
      <p>Oldest change</p>
    </ScrollArea>,
  );
  const region = screen.getByRole('region', { name: 'Audit trail' });
  expect(region.tabIndex).toBe(0);
  region.focus();
  expect(document.activeElement).toBe(region);
  expect(region.contains(screen.getByRole('separator'))).toBe(true);
});
