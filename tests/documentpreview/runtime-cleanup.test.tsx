import { render, screen, cleanup } from '@testing-library/react';

import { afterEach, expect, test, vi } from 'vitest';

import { DocumentPreview } from '../../packages/web/src/patterns';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('a user-provided document string stays text while the explicitly supplied rich-content slot renders', () => {
  const sample = '<img src="/private-record" alt="untrusted">';
  const view = render(<DocumentPreview label="User documents">{sample}</DocumentPreview>);
  expect(screen.getByText(sample)).toBeTruthy();
  expect(view.container.querySelector('img')).toBeNull();
  view.rerender(
    <DocumentPreview label="User documents">
      <article>
        <h2>Verified document</h2>
      </article>
    </DocumentPreview>,
  );
  expect(screen.getByRole('heading', { name: 'Verified document' })).toBeTruthy();
});

test('the preview is one named region that forwards its ref, attributes and host-owned viewer', () => {
  const ref = { current: null as HTMLElement | null };
  render(
    <DocumentPreview ref={ref} label="Contract preview" id="contract" className="viewer" lang="fr">
      <iframe title="Contract, page 1" src="about:blank" />
    </DocumentPreview>,
  );
  const region = screen.getByRole('region', { name: 'Contract preview' });
  expect(ref.current).toBe(region);
  expect(region.tagName).toBe('SECTION');
  expect(region.id).toBe('contract');
  expect(region.className).toBe('uld-document-preview viewer');
  expect(region.getAttribute('lang')).toBe('fr');
  expect(screen.getByTitle('Contract, page 1').parentElement).toBe(region);
  expect(screen.getAllByRole('region')).toHaveLength(1);
});
