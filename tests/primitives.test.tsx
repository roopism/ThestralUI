import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { Avatar } from '../packages/web/src/avatar';
import { Icon, IconButton, Status, Skeleton, Progress, Badge, Stack, Surface, Inline } from '../packages/web/src/primitives';
afterEach(cleanup);
test('layout and decoration preserve accessible names and host attributes', () => {
  render(
    <Surface id="summary">
      <Stack>
        <Inline>
          <Icon>★</Icon>
          <Badge>Active</Badge>
        </Inline>
        <Avatar name="山田 良子" />
        <Skeleton />
        <Progress label="Progression" value={3} max={5} />
      </Stack>
    </Surface>,
  );
  expect(screen.getByRole('img', { name: '山田 良子' })).toBeTruthy();
  expect(screen.queryByRole('img', { name: '★' })).toBeNull();
  expect(screen.getByRole('progressbar', { name: 'Progression' }).getAttribute('max')).toBe('5');
  expect(screen.getByText('Active').closest('#summary')).toBeTruthy();
});
test('icon actions are named, suppress duplicate input while busy, and error feedback is announced', () => {
  const click = vi.fn();
  render(
    <>
      <IconButton label="Retry" busy onClick={click}>
        ↻
      </IconButton>
      <Status tone="error">Timeout</Status>
    </>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(click).not.toHaveBeenCalled();
  expect(screen.getByRole('alert').textContent).toBe('Timeout');
});
