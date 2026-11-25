import { afterEach, expect, test } from 'vitest';

import { createRef } from 'react';

import { cleanup, render, screen } from '@testing-library/react';

import { Status } from '@ui-lazy-dev/ui-web/primitives';

afterEach(cleanup);

test('ordinary updates stay polite and an error becomes an alert while its real message remains readable', () => {
  const { rerender } = render(<Status>Uploading</Status>);
  expect(screen.getByRole('status').dataset.tone).toBe('info');
  rerender(<Status tone="success">Upload complete</Status>);
  expect(screen.getByRole('status').textContent).toBe('Upload complete');
  expect(screen.getByRole('status').dataset.tone).toBe('success');
  rerender(<Status tone="error">Network unavailable</Status>);
  expect(screen.getByRole('alert').textContent).toBe('Network unavailable');
  expect(screen.queryByRole('status')).toBeNull();
});


test('a warning stays a polite status and keeps its readable message', () => {
  render(<Status tone="warning">Storage is 90 percent full</Status>);
  const status = screen.getByRole('status');
  expect(status.dataset.tone).toBe('warning');
  expect(status.textContent).toBe('Storage is 90 percent full');
  expect(screen.queryByRole('alert')).toBeNull();
});

test('the live region persists across message updates so each change is announced in place', () => {
  const { rerender } = render(<Status>Saving draft</Status>);
  const region = screen.getByRole('status');
  rerender(<Status tone="success">Draft saved</Status>);
  expect(screen.getByRole('status')).toBe(region);
  expect(region.textContent).toBe('Draft saved');
  expect(screen.getAllByRole('status')).toHaveLength(1);
});

test('a status forwards its ref, caller class and attributes without adding a tab stop', () => {
  const ref = createRef<HTMLDivElement>();
  render(
    <Status ref={ref} className="form-result" id="result" lang="ar" dir="rtl">
      تم الحفظ
    </Status>,
  );
  const status = screen.getByRole('status');
  expect(ref.current).toBe(status);
  expect(status.className).toBe('uld-status form-result');
  expect(status.id).toBe('result');
  expect(status.tabIndex).toBe(-1);
});
