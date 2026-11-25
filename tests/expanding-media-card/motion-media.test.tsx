import { afterEach, expect, test, vi } from 'vitest';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { ExpandableMediaCard } from '../../packages/web/src/motion';

afterEach(cleanup);

test('media disclosure preserves media state during repeated reversals', () => {
  render(
    <ExpandableMediaCard
      title="Pines"
      media={<video data-testid="media" />}
      expandLabel="Details"
      collapseLabel="Hide"
    >
      A northern passage
    </ExpandableMediaCard>,
  );
  const media = screen.getByTestId('media');
  const action = screen.getByRole('button', { name: 'Details' });
  const details = document.getElementById(action.getAttribute('aria-controls')!)!;
  expect(details.hidden).toBe(true);
  fireEvent.click(action);
  expect(details.hidden).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
  expect(details.hidden).toBe(true);
  expect(screen.getByTestId('media')).toBe(media);
});

test('a controlled card reports each request and shows only the state its owner chooses', () => {
  const change = vi.fn();
  const { rerender } = render(
    <ExpandableMediaCard
      title="Harbour"
      media={<img alt="Harbour at dusk" src="data:," />}
      expandLabel="Show details"
      collapseLabel="Hide details"
      expanded={false}
      onExpandedChange={change}
    >
      Ferry timetable
    </ExpandableMediaCard>,
  );
  const action = screen.getByRole('button', { name: 'Show details' });
  fireEvent.click(action);
  expect(change).toHaveBeenLastCalledWith(true);
  expect(action.getAttribute('aria-expanded')).toBe('false');
  expect(screen.getByText('Ferry timetable').closest('[hidden]')).toBeTruthy();
  rerender(
    <ExpandableMediaCard
      title="Harbour"
      media={<img alt="Harbour at dusk" src="data:," />}
      expandLabel="Show details"
      collapseLabel="Hide details"
      expanded
      onExpandedChange={change}
    >
      Ferry timetable
    </ExpandableMediaCard>,
  );
  const open = screen.getByRole('button', { name: 'Hide details' });
  expect(open).toBe(action);
  expect(open.getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByText('Ferry timetable').closest('[hidden]')).toBeNull();
  fireEvent.click(open);
  expect(change).toHaveBeenLastCalledWith(false);
});

test('an uncontrolled card can start open and keeps its title in the surrounding outline', () => {
  const change = vi.fn();
  render(
    <ExpandableMediaCard
      title="Glacier"
      headingLevel={3}
      defaultExpanded
      onExpandedChange={change}
      media={<img alt="Glacier face" src="data:," />}
      expandLabel="Show route"
      collapseLabel="Hide route"
    >
      Four hour hike
    </ExpandableMediaCard>,
  );
  expect(screen.getByRole('heading', { level: 3, name: 'Glacier' })).toBeTruthy();
  const action = screen.getByRole('button', { name: 'Hide route' });
  expect(action.getAttribute('aria-expanded')).toBe('true');
  fireEvent.click(action);
  expect(change).toHaveBeenCalledWith(false);
  expect(screen.getByRole('button', { name: 'Show route' }).getAttribute('aria-expanded')).toBe('false');
  expect(screen.getByText('Four hour hike').closest('[hidden]')).toBeTruthy();
});
