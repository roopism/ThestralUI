import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { afterEach, expect, test, vi } from 'vitest';

import { FileUpload } from '../../packages/web/src/entry-fields';

afterEach(cleanup);

test('upload forwards browser files, descriptions, disabled state and caller ownership', () => {
  const change = vi.fn();
  const file = new File(['example'], 'work.txt', { type: 'text/plain' });
  const { rerender } = render(
    <FileUpload label="Attachment" hint="Plain text" accept=".txt" multiple onChange={change} />,
  );
  const input = screen.getByLabelText<HTMLInputElement>('Attachment');
  expect(document.getElementById(input.getAttribute('aria-describedby')!)?.textContent).toBe(
    'Plain text',
  );
  fireEvent.change(input, { target: { files: [file] } });
  expect(change).toHaveBeenCalledTimes(1);
  expect(input.files?.[0]).toEqual(file);
  rerender(<FileUpload label="Attachment" disabled />);
  expect(input.disabled).toBe(true);
});
