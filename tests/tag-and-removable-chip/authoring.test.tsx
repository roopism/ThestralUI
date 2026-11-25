import { render, screen, cleanup, fireEvent } from '@testing-library/react';

import { afterEach, expect, test, vi } from 'vitest';

import { Tag, TagGroup, TagList } from '../../packages/web/src/forms';

afterEach(cleanup);

test('removable tags retain an accessible collection name and report the removed key', () => {
  const remove = vi.fn();
  render(
    <TagGroup aria-label="Applied filters" onRemove={remove}>
      <TagList>
        <Tag id="open" textValue="Open">
          Open
        </Tag>
      </TagList>
    </TagGroup>,
  );
  const row = screen.getByRole('row', { name: 'Open' });
  fireEvent.keyDown(row, { key: 'Delete' });
  expect([...remove.mock.lastCall![0]]).toEqual(['open']);
});
