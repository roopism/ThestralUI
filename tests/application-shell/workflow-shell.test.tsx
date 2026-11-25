import { cleanup, render, screen } from '@testing-library/react';

import { afterEach, expect, test } from 'vitest';

import { AppShell } from '../../packages/web/src/workflows';

afterEach(cleanup);

test('links the skip target to the main region and preserves the navigation markup', () => {
  render(
    <AppShell
      skipLabel="Skip to workspace"
      navigationLabel="Workspace"
      navigation={<a href="/jobs">Jobs</a>}
      header={<h1>Hiring</h1>}
    >
      <p>Today</p>
    </AppShell>,
  );
  const main = screen.getByRole('main');
  expect(screen.getByRole('link', { name: 'Skip to workspace' }).getAttribute('href')).toBe(
    '#' + main.id,
  );
  expect(
    screen
      .getByRole('navigation', { name: 'Workspace' })
      .contains(screen.getByRole('link', { name: 'Jobs' })),
  ).toBe(true);
});

test('landmarks follow the skip link in reading order and optional slots collapse when omitted', () => {
  const view = render(
    <AppShell skipLabel="Skip to workspace" navigationLabel="Workspace" navigation={<a href="/jobs">Jobs</a>}>
      <p>Today</p>
    </AppShell>,
  );
  expect(screen.queryByRole('banner')).toBeNull();
  expect(screen.queryByRole('contentinfo')).toBeNull();
  expect(screen.queryByRole('complementary')).toBeNull();
  const root = view.container.firstElementChild!;
  expect(root.querySelectorAll('header, footer, aside')).toHaveLength(0);
  view.rerender(
    <AppShell
      skipLabel="Skip to workspace"
      navigationLabel="Workspace"
      navigation={<a href="/jobs">Jobs</a>}
      header={<h1>Hiring</h1>}
      footer={<small>Support</small>}
      aside={<h2>Filters</h2>}
    >
      <p>Today</p>
    </AppShell>,
  );
  const order = [
    screen.getByRole('link', { name: 'Skip to workspace' }),
    screen.getByRole('banner'),
    screen.getByRole('navigation', { name: 'Workspace' }),
    screen.getByRole('main'),
    screen.getByRole('complementary'),
    screen.getByRole('contentinfo'),
  ];
  for (const [index, node] of order.slice(1).entries())
    expect(order[index].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByRole('complementary').contains(screen.getByRole('heading', { name: 'Filters' }))).toBe(true);
  expect(screen.getAllByRole('main')).toHaveLength(1);
});

test('the skip link is the first focus stop and the main region accepts programmatic focus only', () => {
  render(
    <AppShell skipLabel="Skip to workspace" navigationLabel="Workspace" navigation={<a href="/jobs">Jobs</a>}>
      <p>Today</p>
    </AppShell>,
  );
  const focusable = [...document.querySelectorAll<HTMLElement>('a[href], [tabindex]')];
  expect(focusable[0]).toBe(screen.getByRole('link', { name: 'Skip to workspace' }));
  const main = screen.getByRole('main');
  expect(main.tabIndex).toBe(-1);
  main.focus();
  expect(document.activeElement).toBe(main);
});
