import { ColorField } from '../../packages/web/src/color';

import { render, screen, cleanup, fireEvent } from '@testing-library/react';

import { afterEach, expect, test, vi } from 'vitest';

import { Input, Label } from '../../packages/web/src/forms';

afterEach(cleanup);

test('a palette field has a localized name and emits normalized colors on commit', () => {
  const change = vi.fn();
  render(
    <ColorField defaultValue="#224488" onChange={change}>
      <Label>Accent</Label>
      <Input />
    </ColorField>,
  );
  const input = screen.getByRole('textbox', { name: 'Accent' });
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: '#ff9900' } });
  fireEvent.blur(input);
  expect(change.mock.lastCall?.[0].toString('hex').toLowerCase()).toBe('#ff9900');
});
