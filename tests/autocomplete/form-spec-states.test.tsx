import { afterEach, expect, test } from 'vitest';

import { cleanup, render, screen } from '@testing-library/react';

import { Autocomplete, Input, ListBox, ListBoxItem, SearchField } from '@ui-lazy-dev/ui-web/forms';

afterEach(cleanup);

test('clearing an empty autocomplete query restores the collection and its accessible searchbox', async () => {
  const search = (query: string) => (
    <Autocomplete
      inputValue={query}
      onInputChange={() => {}}
      filter={(label, value) => label.includes(value)}
    >
      <SearchField aria-label="Search teams">
        <Input />
      </SearchField>
      <ListBox aria-label="Teams" renderEmptyState={() => 'No teams match'}>
        <ListBoxItem id="west">West</ListBoxItem>
      </ListBox>
    </Autocomplete>
  );
  const view = render(search('absent'));
  expect(await screen.findByText('No teams match')).toBeTruthy();
  expect(screen.queryByRole('option', { name: 'West' })).toBeNull();
  view.rerender(search(''));
  expect(await screen.findByRole('option', { name: 'West' })).toBeTruthy();
  expect(screen.getByRole<HTMLInputElement>('searchbox', { name: 'Search teams' }).value).toBe('');
});
