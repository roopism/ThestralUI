import { afterEach, expect, test, vi } from 'vitest';

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

import { Calendar, CalendarCell, CalendarGrid, Checkbox, CheckboxGroup, ComboBox, DateField, DateInput, DatePicker, DateRangePicker, DateSegment, Form, Group, Input, ListBox, ListBoxItem, NumberField, Radio, RadioGroup, SearchField, Select, SelectValue, Slider, SliderThumb, SliderTrack, Switch, TextArea, TextField, TimeField, ToggleButton, ToggleButtonGroup } from '@ui-lazy-dev/ui-web/forms';

import { Button } from '@ui-lazy-dev/ui-web';

import { Trigger } from '@ui-lazy-dev/ui-web/navigation';

afterEach(cleanup);

test('text and search fields distinguish a focusable readonly input from a disabled editor', () => {
  render(
    <>
      <TextField aria-label="Record" isReadOnly defaultValue="Locked">
        <Input />
      </TextField>
      <SearchField aria-label="Search archive" isDisabled>
        <Input />
      </SearchField>
      <TextField aria-label="Comment" isRequired isInvalid validationBehavior="aria">
        <TextArea />
      </TextField>
    </>,
  );
  const locked = screen.getByRole<HTMLInputElement>('textbox', { name: 'Record' });
  locked.focus();
  expect(document.activeElement).toBe(locked);
  expect(locked.readOnly).toBe(true);
  expect(locked.value).toBe('Locked');
  const disabled = screen.getByRole<HTMLInputElement>('searchbox', { name: 'Search archive' });
  expect(disabled.disabled).toBe(true);
  disabled.focus();
  expect(document.activeElement).toBe(locked);
  const comment = screen.getByRole('textbox', { name: 'Comment' });
  expect(comment.getAttribute('aria-required')).toBe('true');
  expect(comment.getAttribute('aria-invalid')).toBe('true');
});

test('checkbox and radio groups retain selection in readonly mode and expose unavailable choices', () => {
  const update = vi.fn();
  render(
    <>
      <CheckboxGroup
        aria-label="Subscriptions"
        defaultValue={['news']}
        isReadOnly
        onChange={update}
      >
        <Checkbox value="news">News</Checkbox>
        <Checkbox value="jobs">Jobs</Checkbox>
      </CheckboxGroup>
      <RadioGroup
        aria-label="Delivery"
        defaultValue="weekly"
        isRequired
        validationBehavior="aria"
        onChange={update}
      >
        <Radio value="weekly">Weekly</Radio>
        <Radio value="daily" isDisabled>
          Daily
        </Radio>
      </RadioGroup>
    </>,
  );
  const news = screen.getByRole<HTMLInputElement>('checkbox', { name: 'News' });
  expect(news.checked).toBe(true);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Jobs' }));
  expect(news.checked).toBe(true);
  expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Jobs' }).checked).toBe(false);
  const group = screen.getByRole('radiogroup', { name: 'Delivery' });
  expect(group.getAttribute('aria-required')).toBe('true');
  expect(within(group).getByRole<HTMLInputElement>('radio', { name: 'Daily' }).disabled).toBe(true);
  expect(within(group).getByRole<HTMLInputElement>('radio', { name: 'Weekly' }).checked).toBe(true);
  expect(update).not.toHaveBeenCalled();
});

test('readonly switches ignore activation and a disabled segmented choice cannot be selected', () => {
  const update = vi.fn();
  render(
    <>
      <Switch isReadOnly defaultSelected onChange={update}>
        Send alerts
      </Switch>
      <ToggleButtonGroup
        aria-label="Display"
        defaultSelectedKeys={['rows']}
        onSelectionChange={update}
      >
        <ToggleButton id="rows">Rows</ToggleButton>
        <ToggleButton id="tiles" isDisabled>
          Tiles
        </ToggleButton>
      </ToggleButtonGroup>
    </>,
  );
  const toggle = screen.getByRole<HTMLInputElement>('switch', { name: 'Send alerts' });
  fireEvent.click(toggle);
  expect(toggle.checked).toBe(true);
  const tiles = screen.getByRole<HTMLButtonElement>('radio', { name: 'Tiles' });
  expect(tiles.disabled).toBe(true);
  fireEvent.click(tiles);
  expect(screen.getByRole('radio', { name: 'Rows' }).getAttribute('aria-checked')).toBe('true');
  expect(update).not.toHaveBeenCalled();
});

test('listbox disabled keys, disabled select and readonly combobox keep distinct interaction contracts', () => {
  const select = vi.fn();
  render(
    <>
      <ListBox
        aria-label="Folders"
        selectionMode="single"
        disabledKeys={['closed']}
        onSelectionChange={select}
      >
        <ListBoxItem id="open">Available</ListBoxItem>
        <ListBoxItem id="closed">Locked folder</ListBoxItem>
      </ListBox>
      <Select aria-label="Region" isDisabled>
        <Trigger>
          <SelectValue />
        </Trigger>
        <ListBox>
          <ListBoxItem id="east">East</ListBoxItem>
        </ListBox>
      </Select>
      <ComboBox aria-label="Location" isReadOnly defaultInputValue="Paris">
        <Input />
        <ListBox>
          <ListBoxItem id="paris">Paris</ListBoxItem>
        </ListBox>
      </ComboBox>
    </>,
  );
  const folder = screen.getByRole('option', { name: 'Locked folder' });
  expect(folder.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(folder);
  expect(select).not.toHaveBeenCalled();
  const trigger = screen.getByRole('button') as HTMLButtonElement;
  expect(trigger.disabled).toBe(true);
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
  const location = screen.getByRole<HTMLInputElement>('combobox', { name: 'Location' });
  expect(location.readOnly).toBe(true);
  expect(location.value).toBe('Paris');
});

test('readonly numbers, disabled thumbs and readonly temporal segments expose state on the editing target', () => {
  render(
    <>
      <Slider aria-label="Volume" defaultValue={35} isDisabled>
        <SliderTrack>
          <SliderThumb />
        </SliderTrack>
      </Slider>
      <NumberField aria-label="Quantity" isReadOnly defaultValue={2}>
        <Group>
          <Input />
          <Trigger slot="increment" aria-label="Increase" />
        </Group>
      </NumberField>
      <DateField aria-label="Due" isReadOnly>
        <DateInput>{(s) => <DateSegment segment={s} />}</DateInput>
      </DateField>
      <TimeField aria-label="Start" isReadOnly>
        <DateInput>{(s) => <DateSegment segment={s} />}</DateInput>
      </TimeField>
    </>,
  );
  const thumb = screen.getByRole<HTMLInputElement>('slider');
  expect(thumb.disabled).toBe(true);
  expect(thumb.value).toBe('35');
  const quantity = screen.getByLabelText('Quantity') as HTMLInputElement;
  expect(quantity.readOnly).toBe(true);
  expect(quantity.value).toBe('2');
  for (const label of ['Due', 'Start']) {
    const group = screen.getByRole('group', { name: label });
    const segments = within(group).getAllByRole('spinbutton');
    expect(segments.length).toBeGreaterThan(0);
    expect(segments.every((segment) => segment.getAttribute('aria-readonly') === 'true')).toBe(
      true,
    );
  }
});

test('a disabled picker blocks its trigger and a readonly date range preserves both endpoints', () => {
  const open = vi.fn();
  render(
    <>
      <DatePicker aria-label="Registration deadline" isDisabled onOpenChange={open}>
        <Group>
          <DateInput>{(segment) => <DateSegment segment={segment} />}</DateInput>
          <Trigger aria-label="Choose deadline" />
        </Group>
      </DatePicker>
      <DateRangePicker aria-label="Reporting period" isReadOnly>
        <Group>
          <DateInput slot="start" aria-label="Start">
            {(segment) => <DateSegment segment={segment} />}
          </DateInput>
          <DateInput slot="end" aria-label="End">
            {(segment) => <DateSegment segment={segment} />}
          </DateInput>
        </Group>
      </DateRangePicker>
    </>,
  );
  const trigger = screen.getByRole<HTMLButtonElement>('button', { name: /Choose deadline/ });
  expect(trigger.disabled).toBe(true);
  fireEvent.click(trigger);
  expect(open).not.toHaveBeenCalled();
  const range = within(screen.getByRole('group', { name: 'Reporting period' }));
  for (const name of [/start/i, /end/i]) {
    const segments = range.getAllByRole('spinbutton', { name });
    expect(segments.every((segment) => segment.getAttribute('aria-readonly') === 'true')).toBe(
      true,
    );
  }
});

test('a named form submits enabled fields through its submit action and skips a disabled editor', () => {
  const save = vi.fn();
  render(
    <Form
      aria-label="Directory record"
      onSubmit={(event) => {
        event.preventDefault();
        save(Array.from(new FormData(event.currentTarget)));
      }}
    >
      <Group aria-label="Contact details">
        <TextField aria-label="Title" name="title" defaultValue="Entry">
          <Input />
        </TextField>
        <TextField aria-label="Archive key" name="archive" defaultValue="skip" isDisabled>
          <Input />
        </TextField>
        <Button type="submit">Save record</Button>
      </Group>
    </Form>,
  );
  const form = screen.getByRole('form', { name: 'Directory record' });
  const group = within(form).getByRole('group', { name: 'Contact details' });
  fireEvent.click(within(group).getByRole('button', { name: 'Save record' }));
  expect(save).toHaveBeenCalledWith([['title', 'Entry']]);
});

test('an available calendar date becomes selected and a time field exposes editable clock segments', () => {
  const select = vi.fn();
  render(
    <>
      <Calendar aria-label="Booking days" onChange={select}>
        <CalendarGrid>{(date) => <CalendarCell date={date} />}</CalendarGrid>
      </Calendar>
      <TimeField aria-label="Start time">
        <DateInput>{(segment) => <DateSegment segment={segment} />}</DateInput>
      </TimeField>
    </>,
  );
  const grid = screen.getByRole('grid');
  const first = within(grid)
    .getAllByRole('button')
    .find((day) => !day.hasAttribute('data-outside-month') && !day.hasAttribute('data-disabled'))!;
  fireEvent.click(first);
  expect(select).toHaveBeenCalledOnce();
  expect(first.getAttribute('data-selected')).toBe('true');
  const hours = within(screen.getByRole('group', { name: 'Start time' })).getAllByRole(
    'spinbutton',
  );
  expect(
    hours.some(
      (segment) =>
        segment.getAttribute('data-type') === 'hour' &&
        segment.getAttribute('contenteditable') === 'true',
    ),
  ).toBe(true);
});
