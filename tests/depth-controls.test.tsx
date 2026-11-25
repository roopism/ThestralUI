import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

import { afterEach, expect, test, vi } from 'vitest';

import { useState } from 'react';

import { Autocomplete, Calendar, CalendarCell, CalendarGrid, ComboBox, DateField, DateInput, DatePicker, DateRangePicker, DateSegment, FieldError, Form, Group, Input, Label, ListBox, ListBoxItem, SearchField, TextField, TimeField } from '@ui-lazy-dev/ui-web/forms';

import { Trigger } from '@ui-lazy-dev/ui-web/navigation';

import { ColorPicker, ColorSlider, ColorSwatch, ColorSwatchPicker, ColorSwatchPickerItem, ColorThumb } from '@ui-lazy-dev/ui-web/color';

afterEach(cleanup);

test('form validation reaches a named text input and its associated error message', () => {
  render(
    <Form validationErrors={{ quantity: 'Missing quantity' }}>
      <TextField name="quantity">
        <Label>Quantity</Label>
        <Group>
          <Input />
        </Group>
        <FieldError />
      </TextField>
    </Form>,
  );
  const input = screen.getByRole('textbox', { name: 'Quantity' });
  expect(input.getAttribute('aria-invalid')).toBe('true');
  expect(
    input
      .getAttribute('aria-describedby')
      ?.split(' ')
      .map((id) => document.getElementById(id)?.textContent),
  ).toContain('Missing quantity');
});

test('a combobox keeps its selected label and an autocomplete narrows a collection to the entered query', async () => {
  const view = render(
    <ComboBox defaultSelectedKey="east">
      <Label>Region</Label>
      <Input />
      <ListBox>
        <ListBoxItem id="east">East</ListBoxItem>
        <ListBoxItem id="west">West</ListBoxItem>
      </ListBox>
    </ComboBox>,
  );
  expect(screen.getByRole<HTMLInputElement>('combobox', { name: 'Region' }).value).toBe('East');
  view.unmount();
  function Search() {
    const [query, setQuery] = useState('');
    return (
      <Autocomplete
        inputValue={query}
        onInputChange={setQuery}
        filter={(text, q) => text.toLowerCase().includes(q.toLowerCase())}
      >
        <SearchField aria-label="Find region">
          <Input />
        </SearchField>
        <ListBox aria-label="Results">
          <ListBoxItem id="east">East</ListBoxItem>
          <ListBoxItem id="west">West</ListBoxItem>
        </ListBox>
      </Autocomplete>
    );
  }
  render(<Search />);
  expect(await screen.findByRole('option', { name: 'East' })).toBeDefined();
  fireEvent.change(screen.getByRole('searchbox', { name: 'Find region' }), {
    target: { value: 'west' },
  });
  expect(screen.queryByRole('option', { name: 'East' })).toBeNull();
  expect(screen.getByRole('option', { name: 'West' })).toBeDefined();
});

const segments = () => <DateInput>{(segment) => <DateSegment segment={segment} />}</DateInput>;

test('date and time fields expose independently named editable and readonly segments', () => {
  render(
    <>
      <DateField aria-label="Publication date">{segments()}</DateField>
      <TimeField aria-label="Publication time" isReadOnly>
        {segments()}
      </TimeField>
    </>,
  );
  const date = within(screen.getByRole('group', { name: 'Publication date' }));
  const time = within(screen.getByRole('group', { name: 'Publication time' }));
  const day = date.getAllByRole('spinbutton').find((x) => x.getAttribute('data-type') === 'day');
  expect(day?.getAttribute('contenteditable')).toBe('true');
  expect(
    time.getAllByRole('spinbutton').every((x) => x.getAttribute('aria-readonly') === 'true'),
  ).toBe(true);
});

test('calendar distinguishes unavailable days and both picker endpoints keep independent labels', () => {
  const v = render(
    <Calendar aria-label="Dates" isDateUnavailable={(date) => date.day === 10}>
      <CalendarGrid>{(date) => <CalendarCell date={date} />}</CalendarGrid>
    </Calendar>,
  );
  const dates = within(screen.getByRole('grid'));
  expect(
    dates.getAllByRole('button').some((x) => x.getAttribute('data-unavailable') !== null),
  ).toBe(true);
  expect(
    dates
      .getAllByRole('button')
      .some((x) => !x.hasAttribute('data-unavailable') && !x.hasAttribute('data-disabled')),
  ).toBe(true);
  v.unmount();
  render(
    <>
      <DatePicker>
        <Label>Deadline</Label>
        <Group>
          {segments()}
          <Trigger aria-label="Choose deadline" />
        </Group>
      </DatePicker>
      <DateRangePicker>
        <Label>Window</Label>
        <Group>
          <DateInput slot="start" aria-label="Start date">
            {(segment) => <DateSegment segment={segment} />}
          </DateInput>
          <DateInput slot="end" aria-label="End date">
            {(segment) => <DateSegment segment={segment} />}
          </DateInput>
        </Group>
      </DateRangePicker>
    </>,
  );
  expect(
    screen.getByRole('button', { name: /Choose deadline/ }).getAttribute('aria-haspopup'),
  ).toBe('dialog');
  const range = screen.getByRole('group', { name: 'Window' });
  const ends = within(range)
    .getAllByRole('spinbutton')
    .map((x) => x.getAttribute('aria-label'));
  expect(ends.some((x) => x?.toLowerCase().includes('start date'))).toBe(true);
  expect(ends.some((x) => x?.toLowerCase().includes('end date'))).toBe(true);
});

test('color picker channels expose a numeric control and swatches switch a named selected color', () => {
  const change = vi.fn();
  render(
    <>
      <ColorPicker defaultValue="hsl(120, 60%, 50%)">
        <ColorSlider channel="hue" colorSpace="hsl">
          <Label>Hue</Label>
          <ColorThumb />
        </ColorSlider>
      </ColorPicker>
      <ColorSwatchPicker aria-label="Palette" defaultValue="#cc0000" onChange={change}>
        <ColorSwatchPickerItem color="#cc0000">
          <ColorSwatch colorName="Red" />
        </ColorSwatchPickerItem>
        <ColorSwatchPickerItem color="#0000cc">
          <ColorSwatch colorName="Blue" />
        </ColorSwatchPickerItem>
      </ColorSwatchPicker>
    </>,
  );
  const slider = screen.getByRole<HTMLInputElement>('slider', { name: /Hue/i });
  expect(Number(slider.value)).toBe(120);
  const buttons = within(screen.getByRole('listbox', { name: 'Palette' })).getAllByRole('option');
  expect(buttons[0].getAttribute('aria-selected')).toBe('true');
  fireEvent.click(buttons[1]);
  expect(buttons[1].getAttribute('aria-selected')).toBe('true');
  expect(change.mock.lastCall?.[0].toString('hex').toLowerCase()).toBe('#0000cc');
});
