import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { afterEach, expect, test, vi } from 'vitest';

import { ResourceCard } from '../../packages/web/src/patterns';

afterEach(cleanup);

test('a resource keeps the caller in control of selection and exposes a stable action name', () => {
  const onChange = vi.fn();
  const card = (selected: boolean) => (
    <ResourceCard
      title="Proposal"
      metadata="PDF"
      selected={selected}
      onSelectedChange={onChange}
      actionLabel="Save proposal"
      actionText={selected ? 'Saved' : 'Save'}
    />
  );
  const view = render(card(false));
  const button = screen.getByRole('button', { name: 'Save proposal' });
  fireEvent.click(button);
  expect(onChange).toHaveBeenCalledWith(true);
  expect(button.getAttribute('aria-pressed')).toBe('false');
  view.rerender(card(true));
  expect(button.textContent).toBe('Saved');
  expect(screen.getByRole('article', { name: 'Proposal' })).toBeTruthy();
});

test('the title names the article, metadata and artwork collapse, and the heading follows the outline', () => {
  const { container } = render(
    <ResourceCard
      title="Quarterly review"
      headingLevel={3}
      selected={false}
      onSelectedChange={() => {}}
      actionLabel="Save quarterly review"
      actionText="Save"
    />,
  );
  const article = screen.getByRole('article', { name: 'Quarterly review' });
  expect(screen.getByRole('heading', { level: 3, name: 'Quarterly review' })).toBeTruthy();
  expect(container.querySelector('p')).toBeNull();
  expect(article.children).toHaveLength(1);
});

test('a selected card toggles off through the same action and forwards article attributes', () => {
  const onChange = vi.fn();
  render(
    <ResourceCard
      id="review-card"
      className="shortlist"
      bodyClassName="shortlist-body"
      title="Budget"
      metadata="Spreadsheet · 2 MB"
      artwork={<img alt="" src="data:," />}
      selected
      onSelectedChange={onChange}
      actionLabel="Remove budget from shortlist"
      actionText="Saved"
    />,
  );
  const article = screen.getByRole('article', { name: 'Budget' });
  expect(article.id).toBe('review-card');
  expect(article.className).toBe('uld-resource-card shortlist');
  expect(article.querySelector('.shortlist-body')?.firstElementChild?.textContent).toBe('Spreadsheet · 2 MB');
  const action = screen.getByRole('button', { name: 'Remove budget from shortlist' });
  expect(action.getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(action);
  expect(onChange).toHaveBeenCalledWith(false);
});
