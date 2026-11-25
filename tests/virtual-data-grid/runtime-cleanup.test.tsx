import { render, cleanup } from '@testing-library/react';

import { afterEach, expect, test, vi } from 'vitest';

import { VirtualDataGrid } from '../../packages/web/src/collections';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('unmount disconnects collection observers and removes observed targets', () => {
  const targets = new Set<Element>();
  class Observed {
    observe(n: Element) {
      targets.add(n);
    }
    unobserve(n: Element) {
      targets.delete(n);
    }
    disconnect() {
      targets.clear();
    }
  }
  vi.stubGlobal('ResizeObserver', Observed);
  const view = render(
    <VirtualDataGrid
      label="Tenants"
      rows={[{ id: 'a' }]}
      columns={[{ id: 'name', label: 'Name', render: (r) => r.id }]}
    />,
  );
  expect(targets.size).toBeGreaterThan(0);
  view.unmount();
  expect(targets.size).toBe(0);
});
