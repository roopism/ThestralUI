import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { afterEach, test, expect, vi } from 'vitest';

import { Checkbox, CheckboxGroup, Label, Radio, RadioGroup, Switch, SearchField, Input } from '../packages/web/src/forms';

afterEach(cleanup);

test('selection controls report state to their owners and keep localized names', () => {
  const update = vi.fn();
  render(
    <>
      <CheckboxGroup aria-label="Actions" onChange={update}>
        <Checkbox value="save">保存</Checkbox>
      </CheckboxGroup>
      <RadioGroup aria-label="Mode" defaultValue="a">
        <Radio value="a">Standard</Radio>
        <Radio value="b">Dense</Radio>
      </RadioGroup>
      <Switch>Notifications</Switch>
      <SearchField>
        <Label>検索</Label>
        <Input />
      </SearchField>
    </>,
  );
  fireEvent.click(screen.getByRole('checkbox', { name: '保存' }));
  expect(update).toHaveBeenCalledWith(['save']);
  expect((screen.getByRole('radio', { name: 'Standard' }) as HTMLInputElement).checked).toBe(true);
  expect(screen.getByRole('switch', { name: 'Notifications' })).toBeTruthy();
  expect(screen.getByRole('searchbox', { name: '検索' })).toBeTruthy();
});
