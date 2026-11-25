import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { afterEach, expect, test, vi } from 'vitest';

import { AppNavigation, WorkspacePage, RecordList } from '../packages/web/src/workflows';

afterEach(cleanup);

test('navigation retains real destinations and marks the current page, and list selection belongs to the host', () => {
  const update = vi.fn();
  render(
    <>
      <AppNavigation
        items={[
          { id: 'queue', href: '/jobs', label: 'Queue' },
          { id: 'prefs', href: '/settings', label: 'Preferences' },
        ]}
        currentId="queue"
      />
      <WorkspacePage title="Candidate review" actions={<button>Export</button>}>
        <RecordList
          label="Candidates"
          items={[
            { id: 'a', label: 'Ada' },
            { id: 'b', label: 'Bo' },
          ]}
          selectedId="a"
          onSelect={update}
        />
      </WorkspacePage>
    </>,
  );
  expect(screen.getByRole('link', { name: 'Queue' }).getAttribute('aria-current')).toBe('page');
  expect(screen.getByRole('link', { name: 'Preferences' }).getAttribute('href')).toBe('/settings');
  expect(screen.getByRole('heading', { name: 'Candidate review' })).toBeTruthy();
  expect(screen.getByRole('option', { name: 'Ada' }).getAttribute('aria-selected')).toBe('true');
  const option = screen.getByRole('option', { name: 'Bo' });
  fireEvent.keyDown(option, { key: 'Enter' });
  fireEvent.keyUp(option, { key: 'Enter' });
  expect(update).toHaveBeenCalledWith('b');
});
