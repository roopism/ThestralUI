import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { afterEach, expect, test } from 'vitest';

import { DocumentPreview, PanelHeader } from '../../packages/web/src/patterns';

afterEach(cleanup);

test('a preview accepts the host renderer and loading state without replacing its contents', () => {
  const fixture = (busy: boolean) => (
    <DocumentPreview label="Design review" aria-busy={busy}>
      <PanelHeader>
        <h3>Proof</h3>
      </PanelHeader>
      <input defaultValue="draft" />
    </DocumentPreview>
  );
  const view = render(fixture(true));
  const input = screen.getByRole('textbox');
  fireEvent.change(input, { target: { value: 'reviewed' } });
  view.rerender(fixture(false));
  expect(screen.getByRole('region', { name: 'Design review' }).getAttribute('aria-busy')).toBe(
    'false',
  );
  expect(screen.getByDisplayValue('reviewed')).toBe(input);
});
