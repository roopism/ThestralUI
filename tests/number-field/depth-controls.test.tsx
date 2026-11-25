import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { afterEach, expect, test, vi } from 'vitest';

import { createRef } from 'react';

import { Group, Input, NumberField } from '@ui-lazy-dev/ui-web/forms';

import { I18nProvider, Trigger } from '@ui-lazy-dev/ui-web/navigation';

afterEach(cleanup);

test('number steppers respect the upper bound and emit the numeric value', () => {
  const change = vi.fn();
  render(
    <NumberField aria-label="Copies" defaultValue={1} minValue={1} maxValue={2} onChange={change}>
      <Group>
        <Trigger slot="decrement" aria-label="Decrease" />
        <Input />
        <Trigger slot="increment" aria-label="Increase" />
      </Group>
    </NumberField>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Increase' }));
  expect(change).toHaveBeenCalledWith(2);
  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Increase' }).disabled).toBe(true);
  expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Decrease' }).disabled).toBe(false);
});

const describedBy = (element: HTMLElement) =>
  (element.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent);

test('the default field names its input and localized steppers and describes the input', () => {
  const change = vi.fn();
  render(<NumberField label="Seats" description="Up to ten per order" defaultValue={2} minValue={1} maxValue={10} onChange={change} />);
  const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Seats' });
  expect(input.value).toBe('2');
  expect(describedBy(input)).toEqual(['Up to ten per order']);
  const increase = screen.getByRole('button', { name: /^Increase/ });
  const decrease = screen.getByRole('button', { name: /^Decrease/ });
  expect(increase.getAttribute('aria-label')).toBe('Increase');
  expect(decrease.textContent).toBe('−');
  fireEvent.click(increase);
  expect(change).toHaveBeenLastCalledWith(3);
  expect(input.value).toBe('3');
});

test('omitted slots collapse and a hidden stepper leaves arrow keys stepping the value', () => {
  const change = vi.fn();
  const { container } = render(<NumberField aria-label="Quantity" hideStepper defaultValue={4} step={2} onChange={change} />);
  expect(container.querySelector('.react-aria-Label, [slot="description"], .react-aria-FieldError')).toBeNull();
  expect(screen.queryByRole('button')).toBeNull();
  const input = screen.getByRole('textbox', { name: 'Quantity' });
  fireEvent.keyDown(input, { key: 'ArrowUp', code: 'ArrowUp' });
  expect(change).toHaveBeenLastCalledWith(6);
});

test('locale input is parsed, clamped to its bounds and formatted on commit', () => {
  const change = vi.fn();
  render(
    <I18nProvider locale="de-DE">
      <NumberField label="Rabatt" minValue={0} maxValue={50} step={0.5} formatOptions={{ minimumFractionDigits: 1 }} onChange={change} />
    </I18nProvider>,
  );
  const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Rabatt' });
  fireEvent.change(input, { target: { value: '12,5' } });
  fireEvent.blur(input);
  expect(change).toHaveBeenLastCalledWith(12.5);
  expect(input.value).toBe('12,5');
  fireEvent.change(input, { target: { value: '80' } });
  fireEvent.blur(input);
  expect(change).toHaveBeenLastCalledWith(50);
  expect(input.value).toBe('50,0');
});

test('an invalid field shows its error message in the input description', () => {
  render(<NumberField label="Age" isInvalid validationBehavior="aria" value={3} errorMessage="Enter an age of 18 or more" />);
  const input = screen.getByRole('textbox', { name: 'Age' });
  expect(input.getAttribute('aria-invalid')).toBe('true');
  expect(describedBy(input)).toContain('Enter an age of 18 or more');
});

test('read-only and disabled fields keep their value and block the steppers', () => {
  const ref = createRef<HTMLDivElement>();
  render(
    <div>
      <NumberField ref={ref} label="Locked" isReadOnly defaultValue={5} />
      <NumberField label="Off" isDisabled defaultValue={1} />
    </div>,
  );
  const locked = screen.getByRole<HTMLInputElement>('textbox', { name: 'Locked' });
  expect(locked.readOnly).toBe(true);
  expect(ref.current!.contains(locked)).toBe(true);
  expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Off' }).disabled).toBe(true);
  for (const button of screen.getAllByRole<HTMLButtonElement>('button')) expect(button.disabled).toBe(true);
});
