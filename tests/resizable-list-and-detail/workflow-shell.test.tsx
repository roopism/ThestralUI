import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { afterEach, expect, test, vi } from 'vitest';

import { SplitView } from '../../packages/web/src/workflows';

afterEach(cleanup);

test('clamps resize commands and preserves input state and focus between panes', () => {
  const resized = vi.fn();
  render(
    <SplitView
      listLabel="Positions"
      detailLabel="Review"
      resizeLabel="Resize positions"
      list={<button>Selected position</button>}
      detail={<input aria-label="Draft" />}
      onSizeChange={resized}
    />,
  );
  const handle = screen.getByRole('separator', { name: 'Resize positions' });
  fireEvent.keyDown(handle, { key: 'Home' });
  expect(handle.getAttribute('aria-valuenow')).toBe('20');
  fireEvent.keyDown(handle, { key: 'ArrowLeft' });
  expect(handle.getAttribute('aria-valuenow')).toBe('20');
  fireEvent.keyDown(handle, { key: 'End' });
  expect(resized).toHaveBeenLastCalledWith(80);
  fireEvent.keyDown(handle, { key: 'ArrowLeft' });
  expect(resized).toHaveBeenLastCalledWith(79);
  const draft = screen.getByRole('textbox');
  fireEvent.change(draft, { target: { value: 'Unsaved' } });
  draft.focus();
  fireEvent.keyDown(draft, { key: 'F6' });
  expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Positions' }));
  fireEvent.keyDown(document.activeElement!, { key: 'F6' });
  expect(document.activeElement).toBe(draft);
  expect((draft as HTMLInputElement).value).toBe('Unsaved');
});

function Split(props: Partial<Parameters<typeof SplitView>[0]>) {
  return (
    <SplitView
      listLabel="Positions"
      detailLabel="Review"
      resizeLabel="Resize positions"
      list={<button>Selected position</button>}
      detail={<p>Notes</p>}
      {...props}
    />
  );
}

test('the handle is a named vertical separator that reports its range and controls the list', () => {
  render(<Split defaultSize={55} minSize={30} maxSize={70} />);
  const handle = screen.getByRole('separator', { name: 'Resize positions' });
  expect(handle.tabIndex).toBe(0);
  expect(handle.getAttribute('aria-orientation')).toBe('vertical');
  expect([handle.getAttribute('aria-valuemin'), handle.getAttribute('aria-valuemax')]).toEqual(['30', '70']);
  expect(handle.getAttribute('aria-valuenow')).toBe('55');
  expect(handle.getAttribute('aria-valuetext')).toBe('55%');
  expect(handle.getAttribute('aria-controls')).toBe(screen.getByRole('region', { name: 'Positions' }).id);
  fireEvent.keyDown(handle, { key: 'ArrowRight', shiftKey: true });
  expect(handle.getAttribute('aria-valuenow')).toBe('65');
  fireEvent.keyDown(handle, { key: 'ArrowRight', shiftKey: true });
  expect(handle.getAttribute('aria-valuenow')).toBe('70');
  fireEvent.keyDown(handle, { key: 'Home' });
  expect(handle.getAttribute('aria-valuenow')).toBe('30');
});

test('Enter collapses the list to its minimum and a second Enter restores the previous size', () => {
  const resized = vi.fn();
  render(<Split defaultSize={45} onSizeChange={resized} />);
  const handle = screen.getByRole('separator', { name: 'Resize positions' });
  fireEvent.keyDown(handle, { key: 'Enter' });
  expect(handle.getAttribute('aria-valuenow')).toBe('20');
  fireEvent.keyDown(handle, { key: 'Enter' });
  expect(handle.getAttribute('aria-valuenow')).toBe('45');
  expect(resized.mock.calls.map(([value]) => value)).toEqual([20, 45]);
});

test('a controlled size follows the owner and only reports requested changes', () => {
  const resized = vi.fn();
  const view = render(<Split size={50} onSizeChange={resized} />);
  const handle = screen.getByRole('separator', { name: 'Resize positions' });
  fireEvent.keyDown(handle, { key: 'ArrowRight' });
  expect(resized).toHaveBeenLastCalledWith(51);
  expect(handle.getAttribute('aria-valuenow')).toBe('50');
  view.rerender(<Split size={51} onSizeChange={resized} />);
  expect(handle.getAttribute('aria-valuenow')).toBe('51');
  view.rerender(<Split size={95} onSizeChange={resized} />);
  expect(handle.getAttribute('aria-valuenow')).toBe('80');
});

test('right-to-left content reverses the arrow keys and ignores modified F6', () => {
  render(
    <div dir="rtl" style={{ direction: 'rtl' }}>
      <Split defaultSize={40} />
    </div>,
  );
  const handle = screen.getByRole('separator', { name: 'Resize positions' });
  fireEvent.keyDown(handle, { key: 'ArrowLeft' });
  expect(handle.getAttribute('aria-valuenow')).toBe('41');
  fireEvent.keyDown(handle, { key: 'ArrowRight' });
  expect(handle.getAttribute('aria-valuenow')).toBe('40');
  const action = screen.getByRole('button', { name: 'Selected position' });
  action.focus();
  fireEvent.keyDown(action, { key: 'F6', ctrlKey: true });
  expect(document.activeElement).toBe(action);
});

test('F6 switches to the pane when its remembered control becomes disabled', () => {
  const split = (disabled: boolean) => <Split detail={<button disabled={disabled}>Review action</button>} />;
  const view = render(split(false));
  const action = screen.getByRole('button', { name: 'Review action' });
  const list = screen.getByRole('region', { name: 'Positions' });
  const detail = screen.getByRole('region', { name: 'Review' });
  action.focus();
  fireEvent.keyDown(action, { key: 'F6' });
  expect(document.activeElement).toBe(list);
  view.rerender(split(true));
  fireEvent.keyDown(list, { key: 'F6' });
  expect(document.activeElement).toBe(detail);
  fireEvent.keyDown(detail, { key: 'F6' });
  expect(document.activeElement).toBe(list);
});
