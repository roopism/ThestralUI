import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { afterEach, expect, test, vi } from 'vitest';

import { BatchProgress } from '../../packages/web/src/workflows';

afterEach(cleanup);

test('batch progress handles partial failure, retries a single failed item and resumes from external state', () => {
  const retry = vi.fn();
  const tasks = [
    { id: 'a', label: 'Résumé', state: 'complete' as const },
    { id: 'b', label: 'Portfolio', state: 'failed' as const, detail: 'Upload interrupted' },
    { id: 'c', label: 'Cover letter', state: 'denied' as const },
  ];
  const { rerender } = render(<BatchProgress label="Export batch" items={tasks} onRetry={retry} />);
  expect((screen.getByRole('progressbar') as HTMLProgressElement).value).toBe(3);
  expect(screen.getAllByRole('button')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Retry Portfolio' }));
  expect(retry).toHaveBeenCalledWith('b');
  rerender(
    <BatchProgress
      label="Export batch"
      items={tasks.map((t) => (t.id === 'b' ? { ...t, state: 'running' } : t))}
      onRetry={retry}
    />,
  );
  expect((screen.getByRole('progressbar') as HTMLProgressElement).value).toBe(2);
  expect(screen.queryByRole('button')).toBe(null);
});

test('two or more failures offer one retry for every failed operation', () => {
  const retryFailed = vi.fn();
  const items = [
    { id: 'a', label: 'Invoice', state: 'failed' as const },
    { id: 'b', label: 'Receipt', state: 'complete' as const },
    { id: 'c', label: 'Statement', state: 'failed' as const },
  ];
  const { rerender } = render(
    <BatchProgress
      label="Exports"
      items={items}
      onRetry={() => {}}
      retryFailed={{ label: (count) => 'Retry ' + count + ' failed', onRetry: retryFailed }}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Retry 2 failed' }));
  expect(retryFailed).toHaveBeenCalledWith(['a', 'c']);
  rerender(
    <BatchProgress
      label="Exports"
      items={items.map((item) => (item.id === 'a' ? { ...item, state: 'running' as const } : item))}
      retryFailed={{ label: (count) => 'Réessayer ' + count, onRetry: retryFailed }}
    />,
  );
  expect(screen.queryByRole('button', { name: /Retry|Réessayer/ })).toBeNull();
});

test('the batch heading names the region, list and progress, and keeps its outline level', () => {
  render(
    <BatchProgress
      label="Monthly close"
      headingLevel={3}
      items={[
        { id: 'a', label: 'Ledger', state: 'running' },
        { id: 'b', label: 'Payroll', state: 'queued' },
      ]}
    />,
  );
  expect(screen.getByRole('heading', { level: 3, name: 'Monthly close' })).toBeTruthy();
  expect(screen.getByRole('region', { name: 'Monthly close' })).toBeTruthy();
  expect(screen.getByRole('list', { name: 'Monthly close' })).toBeTruthy();
  expect(screen.getByRole('progressbar', { name: 'Monthly close' })).toBeTruthy();
  const running = screen.getByText('Ledger').closest('li')!;
  expect(running.dataset.state).toBe('running');
  expect(running.querySelector('.uld-spinner')?.getAttribute('aria-hidden')).toBe('true');
  expect(screen.getAllByRole('status')).toHaveLength(1);
  expect(screen.getByRole('status').textContent).toBe('0 of 2 finished');
});

test('retrying a failed item focuses the next failed action and preserves a vetoed action', () => {
  const items = ['Invoice', 'Receipt'].map(label => ({ label, id: label, state: 'failed' as const }));
  const props = { label: 'Exports', items, onRetry: vi.fn() };
  const { rerender } = render(<BatchProgress {...props} />);
  const invoice = screen.getByRole('button', { name: 'Retry Invoice' });
  invoice.focus();
  fireEvent.click(invoice);
  expect(props.onRetry).toHaveBeenCalledWith('Invoice');
  rerender(<BatchProgress {...props} />);
  expect(document.activeElement).toBe(invoice);
  rerender(<BatchProgress {...props} items={[{ ...items[0], state: 'running' }, items[1]]} />);
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Retry Receipt' }));
});
