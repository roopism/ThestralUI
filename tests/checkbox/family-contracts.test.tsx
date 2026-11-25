import { afterEach, expect, test, vi } from 'vitest';

import { cleanup, render, fireEvent, screen } from '@testing-library/react';

import { Checkbox } from '../../packages/web/src/forms';

import { I18nProvider } from '../../packages/web/src/navigation';

afterEach(cleanup);

test('controlled selection stays owner-driven and its event does not mutate the supplied value', () => {
  const change = vi.fn();
  const shape = (selected: boolean) => (
    <I18nProvider locale="ja">
      <Checkbox isSelected={selected} onChange={change}>
        通知
      </Checkbox>
    </I18nProvider>
  );
  const { rerender } = render(shape(false));
  const box = screen.getByRole<HTMLInputElement>('checkbox', { name: '通知' });
  fireEvent.click(box);
  expect(change).toHaveBeenCalledWith(true);
  expect(box.checked).toBe(false);
  rerender(shape(true));
  expect(box.checked).toBe(true);
});
