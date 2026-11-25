import { afterEach, expect, test, vi } from 'vitest';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { Button, useButton } from '@ui-lazy-dev/ui-web';

afterEach(cleanup);

test('a pending submit keeps focus and its name, and cannot submit again', () => {
  const click = vi.fn();
  const submit = vi.fn();
  const { rerender } = render(
    <form onSubmit={event => { event.preventDefault(); submit(); }}>
      <Button type="submit" onClick={click}>Save changes</Button>
    </form>,
  );
  const button = screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement;
  button.focus();
  rerender(
    <form onSubmit={event => { event.preventDefault(); submit(); }}>
      <Button type="submit" busy onClick={click}>Save changes</Button>
    </form>,
  );
  expect(screen.getByRole('button', { name: 'Save changes' })).toBe(button);
  expect(document.activeElement).toBe(button);
  expect(button.disabled).toBe(false);
  expect(button.type).toBe('submit');
  expect(button.getAttribute('aria-busy')).toBe('true');
  expect(button.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(button);
  expect(click).not.toHaveBeenCalled();
  expect(submit).not.toHaveBeenCalled();
});

test('an explicitly disabled action leaves the focus order and stays disabled while busy', () => {
  const { rerender } = render(<Button disabled busy>Archive</Button>);
  const button = screen.getByRole('button', { name: 'Archive' }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  expect(button.hasAttribute('aria-disabled')).toBe(false);
  rerender(<Button aria-disabled="true">Archive</Button>);
  expect(button.getAttribute('aria-disabled')).toBe('true');
  expect(button.disabled).toBe(false);
  rerender(<Button aria-disabled={false}>Archive</Button>);
  expect(button.getAttribute('aria-disabled')).toBe('false');
  rerender(<Button aria-disabled={false} busy>Archive</Button>);
  expect(button.getAttribute('aria-disabled')).toBe('true');
});

test('a standard action does not accidentally submit the surrounding form', () => {
  const submit = vi.fn();
  render(
    <form id="draft-editor" onSubmit={event => {
      event.preventDefault();
      submit((event.nativeEvent as SubmitEvent).submitter);
    }}>
      <Button>Cancel</Button>
      <Button type="submit">Save</Button>
    </form>,
  );
  const cancel = screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement;
  expect(cancel.type).toBe('button');
  fireEvent.click(cancel);
  expect(submit).not.toHaveBeenCalled();

  const save = screen.getByRole('button', { name: 'Save' });
  fireEvent.click(save);
  expect(submit).toHaveBeenCalledExactlyOnceWith(save);

  const preview = vi.fn();
  const previewForm = (owner: string) => (
    <form id="preview-form" onSubmit={event => {
      event.preventDefault();
      preview((event.nativeEvent as SubmitEvent).submitter);
    }}>
      <Button type="submit" form={owner}>Preview draft</Button>
    </form>
  );
  const { rerender } = render(previewForm('draft-editor'));
  const external = screen.getByRole('button', { name: 'Preview draft' });
  fireEvent.click(external);
  expect(submit).toHaveBeenNthCalledWith(2, external);
  expect(preview).not.toHaveBeenCalled();

  rerender(previewForm('preview-form'));
  expect(screen.getByRole('button', { name: 'Preview draft' })).toBe(external);
  fireEvent.click(external);
  expect(preview).toHaveBeenCalledExactlyOnceWith(external);
  expect(submit).toHaveBeenCalledTimes(2);
});

test('decorative start and end icons keep their logical order, including while the action is busy', () => {
  const click = vi.fn();
  const props = {
    startIcon: (
      <svg aria-label="Leading glyph">
        <title>Leading glyph</title>
      </svg>
    ),
    endIcon: (
      <svg aria-label="Trailing glyph">
        <title>Trailing glyph</title>
      </svg>
    ),
    size: 'lg' as const,
    onClick: click,
  };
  const { rerender } = render(<Button {...props}>Publish</Button>);
  const action = screen.getByRole('button', { name: 'Publish' });
  const parts = () => Array.from(action.children).map((node) => node.getAttribute('data-part'));
  expect(parts()).toEqual(['start-icon', 'label', 'end-icon']);
  const wrappers = Array.from(action.querySelectorAll('[data-part$="-icon"]'));
  expect(wrappers).toHaveLength(2);
  expect(wrappers.map((node) => node.textContent)).toEqual(['Leading glyph', 'Trailing glyph']);
  expect(wrappers.every((node) => node.hasAttribute('inert') && node.getAttribute('aria-hidden') === 'true')).toBe(true);
  expect(action.querySelector('[data-part="label"]')?.textContent).toBe('Publish');
  fireEvent.click(action);
  rerender(
    <Button {...props} busy>
      Publish
    </Button>,
  );
  expect(screen.getByRole('button', { name: 'Publish' })).toBe(action);
  expect(parts()).toEqual(['start-icon', 'label', 'end-icon', 'busy-indicator']);
  expect(action.querySelector('[data-part="busy-indicator"]')?.getAttribute('aria-hidden')).toBe('true');
  fireEvent.click(action);
  expect(click).toHaveBeenCalledTimes(1);

  rerender(<Button {...props} startIcon={<span hidden>Hidden leading glyph</span>}>Publish</Button>);
  expect(screen.getByRole('button', { name: 'Publish' })).toBe(action);
  expect(parts()).toEqual(['label', 'end-icon']);
});

test('every part has a stable class name and data-part, also in unstyled mode', () => {
  const { rerender } = render(<Button startIcon={<svg />} busy>Upload</Button>);
  const button = screen.getByRole('button', { name: 'Upload' });
  const named = () =>
    [button, ...Array.from(button.children)].map((node) => [
      node.getAttribute('data-part'),
      Array.from(node.classList).filter((name) => name.startsWith('uld-button-')),
    ]);
  const expected = [
    ['root', ['uld-button-root']],
    ['start-icon', ['uld-button-start-icon']],
    ['label', ['uld-button-label']],
    ['busy-indicator', ['uld-button-busy-indicator']],
  ];
  expect(named()).toEqual(expected);
  expect(button.classList.contains('uld-button')).toBe(true);
  rerender(<Button startIcon={<svg />} busy unstyled className="app-action">Upload</Button>);
  expect(named()).toEqual(expected);
  expect(button.classList.contains('uld-button')).toBe(false);
  expect(button.classList.contains('app-action')).toBe(true);
  expect(button.getAttribute('aria-busy')).toBe('true');
});

test('tones and full width are exposed for styling', () => {
  for (const tone of ['primary', 'secondary', 'ghost', 'danger', 'link'] as const) {
    render(<Button tone={tone} fullWidth>{tone}</Button>);
    const button = screen.getByRole('button', { name: tone });
    expect(button.getAttribute('data-tone')).toBe(tone);
    expect(button.hasAttribute('data-full-width')).toBe(true);
  }
  render(<Button>Default</Button>);
  const plain = screen.getByRole('button', { name: 'Default' });
  expect(plain.getAttribute('data-tone')).toBe('primary');
  expect(plain.hasAttribute('data-full-width')).toBe(false);
});

test('the headless hook gives a plain button the same pending behaviour', () => {
  const click = vi.fn();
  function Plain({ busy }: { busy?: boolean }) {
    const { buttonProps } = useButton({ busy, onClick: click });
    return <button {...buttonProps}>Retry</button>;
  }
  const { rerender } = render(<Plain />);
  const button = screen.getByRole('button', { name: 'Retry' }) as HTMLButtonElement;
  expect(button.type).toBe('button');
  fireEvent.click(button);
  expect(click).toHaveBeenCalledTimes(1);
  rerender(<Plain busy />);
  fireEvent.click(button);
  expect(click).toHaveBeenCalledTimes(1);
  expect(button.getAttribute('aria-busy')).toBe('true');
  expect(button.disabled).toBe(false);
  expect(button.className).toBe('');
});
