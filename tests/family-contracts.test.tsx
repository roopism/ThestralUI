import { createRef } from 'react';

import { afterEach, expect, test } from 'vitest';

import { cleanup, render, screen } from '@testing-library/react';

import { ButtonGroup, Box, Inline, ScrollArea, Text, Icon, Spinner, Skeleton } from '../packages/web/src/primitives';

import { Input, Label, TextField } from '../packages/web/src/forms';

import { PanelHeader, DocumentPreview } from '../packages/web/src/patterns';

afterEach(cleanup);

test('public host refs point at the interactive element and detach on unmount', () => {
  const input = createRef<HTMLInputElement>(),
    panel = createRef<HTMLDivElement>(),
    preview = createRef<HTMLElement>();
  const { unmount } = render(
    <DocumentPreview ref={preview} label="Preview">
      <PanelHeader ref={panel}>Contract</PanelHeader>
      <TextField>
        <Label>Field</Label>
        <Input ref={input} />
      </TextField>
    </DocumentPreview>,
  );
  expect(input.current).toBe(screen.getByRole('textbox'));
  expect(preview.current).toBe(screen.getByRole('region'));
  expect(panel.current).toBe(screen.getByText('Contract'));
  unmount();
  expect(input.current).toBeNull();
  expect(preview.current).toBeNull();
  expect(panel.current).toBeNull();
});

test('layout, loading, image and grouping slots preserve native roles, names, and caller content', () => {
  render(
    <Box>
      <ButtonGroup label="Actions">
        <Inline>
          <Text>Review</Text>
          <Icon label="Verified">✓</Icon>
        </Inline>
      </ButtonGroup>
      <ScrollArea label="Activity">
        <Spinner label="Loading activity" />
        <Skeleton data-testid="skeleton" />
      </ScrollArea>
    </Box>,
  );
  expect(screen.getByRole('group', { name: 'Actions' }).contains(screen.getByText('Review'))).toBe(
    true,
  );
  expect(screen.getByRole('img', { name: 'Verified' })).toBeTruthy();
  expect(screen.getByRole('region', { name: 'Activity' })).toBeTruthy();
  expect(screen.getByTestId('skeleton').getAttribute('aria-hidden')).toBe('true');
  expect(screen.getByLabelText('Loading activity')).toBeTruthy();
});
