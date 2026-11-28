import { afterEach, expect, test, vi } from 'vitest';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { Carousel } from '../../packages/web/src/motion';

afterEach(cleanup);

const labels = {
  previous: 'Previous route',
  next: 'Next route',
  carousel: 'carousel',
  slide: 'slide',
  position: (position: number, total: number) => position + ' of ' + total,
};

const items = ['A', 'B', 'C'].map((id) => ({
  id,
  label: 'Route ' + id,
  content: <button>Save {id}</button>,
}));

test('carousel keeps selection by id and exposes only the selected slide to keyboard users', () => {
  const { rerender } = render(<Carousel label="Routes" labels={labels} items={items} />);
  fireEvent.click(screen.getByRole('button', { name: 'Next route' }));
  expect(screen.getByRole('status').textContent).toBe('2 of 3');
  expect(screen.getByText('Save B').closest('[inert]')).toBeNull();
  expect(screen.getByText('Save A').closest('[inert]')).toBeTruthy();
  rerender(<Carousel label="Routes" labels={labels} items={[items[1], items[2]]} />);
  expect(screen.getByRole('status').textContent).toBe('1 of 2');
  rerender(<Carousel label="Routes" labels={labels} items={[]} />);
  expect(screen.queryByRole('button')).toBeNull();
});

test('the carousel and each slide carry their role descriptions and only the current slide is exposed', () => {
  render(<Carousel label="Routes" labels={labels} items={items} defaultSelectedId="B" />);
  const carousel = screen.getByRole('region', { name: 'Routes' });
  expect(carousel.getAttribute('aria-roledescription')).toBe('carousel');
  const viewport = screen.getByRole('group', { name: 'Routes' });
  expect(viewport.tabIndex).toBe(0);
  const slide = screen.getByRole('group', { name: 'Route B' });
  expect(slide.getAttribute('aria-roledescription')).toBe('slide');
  expect(screen.queryByRole('group', { name: 'Route A' })).toBeNull();
  expect(screen.getByRole('status').textContent).toBe('2 of 3');
  for (const name of ['Previous route', 'Next route'])
    expect(screen.getByRole('button', { name }).getAttribute('aria-controls')).toBe(viewport.id);
});

test('arrow keys follow the reading direction, Home and End reach the ends and the ends disable their control', () => {
  const changed = vi.fn();
  const view = render(<Carousel label="Routes" labels={labels} items={items} onSelectionChange={changed} />);
  const viewport = screen.getByRole('group', { name: 'Routes' });
  expect(screen.getByRole('button', { name: 'Previous route' }).getAttribute('aria-disabled')).toBe('true');
  fireEvent.keyDown(viewport, { key: 'ArrowRight' });
  expect(screen.getByRole('status').textContent).toBe('2 of 3');
  fireEvent.keyDown(viewport, { key: 'End' });
  expect(screen.getByRole('status').textContent).toBe('3 of 3');
  expect(screen.getByRole('button', { name: 'Next route' }).getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: 'Next route' }));
  fireEvent.keyDown(viewport, { key: 'ArrowRight', ctrlKey: true });
  expect(screen.getByRole('status').textContent).toBe('3 of 3');
  fireEvent.keyDown(viewport, { key: 'Home' });
  expect(changed.mock.calls.map(([id]) => id)).toEqual(['B', 'C', 'A']);
  view.unmount();
  render(
    <div dir="rtl" style={{ direction: 'rtl' }}>
      <Carousel label="Routes" labels={labels} items={items} />
    </div>,
  );
  const mirrored = screen.getByRole('group', { name: 'Routes' });
  fireEvent.keyDown(mirrored, { key: 'ArrowLeft' });
  expect(screen.getByRole('status').textContent).toBe('2 of 3');
  fireEvent.keyDown(mirrored, { key: 'ArrowRight' });
  expect(screen.getByRole('status').textContent).toBe('1 of 3');
});

test('a controlled carousel shows the owner slide and reports requests without moving on its own', () => {
  const changed = vi.fn();
  const view = render(
    <Carousel label="Routes" labels={labels} items={items} selectedId="A" onSelectionChange={changed} />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Next route' }));
  expect(changed).toHaveBeenLastCalledWith('B');
  expect(screen.getByRole('status').textContent).toBe('1 of 3');
  view.rerender(<Carousel label="Routes" labels={labels} items={items} selectedId="C" onSelectionChange={changed} />);
  expect(screen.getByRole('status').textContent).toBe('3 of 3');
  expect(screen.getByText('Save C').closest('[inert]')).toBeNull();
  expect(screen.getByText('Save A').closest('[inert]')).toBeTruthy();
});

test('a settled swipe aligns the viewport with the controlled selection', () => {
  const change = vi.fn();
  const slides = (id: string) => <Carousel label="Routes" labels={labels} items={items} selectedId={id} onSelectionChange={change} />;
  const view = render(slides('A'));
  const viewport = screen.getByRole('group', { name: 'Routes' });
  Object.defineProperty(viewport, 'clientWidth', { value: 320 });
  viewport.scrollLeft = 310;
  fireEvent.scroll(viewport);
  viewport.scrollLeft = 320;
  fireEvent.scroll(viewport);
  expect(change.mock.calls).toEqual([['B']]);
  fireEvent(viewport, new Event('scrollend'));
  expect(viewport.scrollLeft).toBe(0);
  expect(screen.getByRole('button', { name: 'Save A' })).toBeTruthy();
  expect(screen.getByRole('status').textContent).toBe('1 of 3');
  viewport.scrollLeft = 320;
  fireEvent.scroll(viewport);
  view.rerender(slides('B'));
  fireEvent(viewport, new Event('scrollend'));
  expect(viewport.scrollLeft).toBe(320);
  expect(screen.getByRole('button', { name: 'Save B' })).toBeTruthy();
  expect(screen.getByRole('status').textContent).toBe('2 of 3');
});

test('reversing a swipe updates the pending request of a delayed carousel owner', () => {
  const changed = vi.fn();
  const slides = (id: string) =>
    <Carousel label="Routes" labels={labels} items={items} selectedId={id} onSelectionChange={changed} />;
  const view = render(slides('A'));
  const viewport = screen.getByRole('group', { name: 'Routes' });
  Object.defineProperty(viewport, 'clientWidth', { value: 320 });
  viewport.scrollLeft = 320;
  fireEvent.scroll(viewport);
  viewport.scrollLeft = 0;
  fireEvent.scroll(viewport);
  expect(changed.mock.calls).toEqual([['B'], ['A']]);

  view.rerender(slides(changed.mock.lastCall![0]));
  expect(screen.getByRole('button', { name: 'Save A' })).toBeTruthy();
  view.rerender(slides('C'));
  fireEvent.scroll(viewport);
  expect(viewport.scrollLeft).toBe(640);
  expect(changed.mock.calls).toEqual([['B'], ['A']]);
});
