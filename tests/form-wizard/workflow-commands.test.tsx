import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { afterEach, expect, test, vi } from 'vitest';

import { useState } from 'react';

import { Wizard } from '../../packages/web/src/workflows';

afterEach(cleanup);

test('retains draft controls across steps and focuses the new step heading', () => {
  const submit = vi.fn();
  function Example() {
    const [step, setStep] = useState('who');
    return (
      <Wizard
        label="Provision account"
        steps={[
          { id: 'who', label: 'Identity', content: <input aria-label="Name" /> },
          { id: 'review', label: 'Review', content: <p>Approve account</p> },
        ]}
        activeId={step}
        onStepChange={setStep}
        onFinish={submit}
      />
    );
  }
  render(<Example />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Mei' } });
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Review' }));
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('Mei');
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
  expect(submit).toHaveBeenCalledTimes(1);
});

test('an invalid step cannot advance and pending submissions are disabled', () => {
  const change = vi.fn();
  const props = {
    label: 'Wizard',
    activeId: 'a',
    onStepChange: change,
    onFinish: vi.fn(),
    steps: [
      { id: 'a', label: 'Name', content: <input required aria-label="Name" /> },
      { id: 'b', label: 'Review', content: null },
    ],
  };
  const { rerender } = render(<Wizard {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(change).not.toHaveBeenCalled();
  const [entry, review] = props.steps;
  rerender(<Wizard {...props} steps={[{ ...entry, canAdvance: false }, review]} />);
  expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true);
  rerender(<Wizard {...props} />);
  const next = screen.getByRole<HTMLButtonElement>('button', { name: 'Next' });
  next.focus();
  rerender(<Wizard {...props} busy />);
  expect(next.getAttribute('aria-busy')).toBe('true');
  expect(next.getAttribute('aria-disabled')).toBe('true');
  expect(next.disabled).toBe(false);
  expect(document.activeElement).toBe(next);
  next.click();
  expect(change).not.toHaveBeenCalled();
});
