import { afterEach, expect, test } from 'vitest';

import { cleanup, render, screen } from '@testing-library/react';

import { Progress } from '@ui-lazy-dev/ui-web/primitives';

afterEach(cleanup);

test('indeterminate progress retains its name, then exposes a native fraction when work is measured', () => {
  const { rerender } = render(<Progress label="Import" />);
  const bar = screen.getByRole<HTMLProgressElement>('progressbar', { name: 'Import' });
  expect(bar.hasAttribute('value')).toBe(false);
  expect(bar.position).toBe(-1);
  rerender(<Progress label="Import" max={5} value={0} />);
  expect(screen.getByRole('progressbar')).toBe(bar);
  expect(bar.position).toBe(0);
  rerender(<Progress label="Import" max={5} value={2} />);
  expect(bar.position).toBe(0.4);
});

test('a localized value text and caller attributes reach the native progress element', () => {
  render(<Progress label="Upload" max={8} value={6} aria-valuetext="6 of 8 files" id="upload" dir="rtl" />);
  const bar = screen.getByRole<HTMLProgressElement>('progressbar', { name: 'Upload' });
  expect(bar.getAttribute('aria-valuetext')).toBe('6 of 8 files');
  expect(bar.id).toBe('upload');
  expect(bar.getAttribute('dir')).toBe('rtl');
  expect(bar.position).toBe(0.75);
  expect(bar.tabIndex).toBe(-1);
});

test('completed work reports a full fraction and keeps the same element', () => {
  const { rerender } = render(<Progress label="Export" max={4} value={3} />);
  const bar = screen.getByRole<HTMLProgressElement>('progressbar', { name: 'Export' });
  rerender(<Progress label="Export" max={4} value={4} />);
  expect(screen.getByRole('progressbar')).toBe(bar);
  expect(bar.position).toBe(1);
  expect(screen.queryByRole('status')).toBeNull();
});
