import { afterEach, expect, test, vi } from 'vitest';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { Slider, SliderThumb, SliderTrack } from '@ui-lazy-dev/ui-web/forms';

afterEach(cleanup);

test('a slider moves by its step with arrow keys and respects the keyboard bound', () => {
  const change = vi.fn();
  render(
    <Slider
      aria-label="Zoom"
      minValue={0}
      maxValue={10}
      step={5}
      defaultValue={5}
      onChange={change}
    >
      <SliderTrack>
        <SliderThumb />
      </SliderTrack>
    </Slider>,
  );
  const thumb = screen.getByRole<HTMLInputElement>('slider', { name: 'Zoom' });
  thumb.focus();
  fireEvent.keyDown(thumb, { key: 'ArrowRight', code: 'ArrowRight' });
  expect(change).toHaveBeenLastCalledWith(10);
  expect(thumb.value).toBe('10');
  fireEvent.keyDown(thumb, { key: 'ArrowRight', code: 'ArrowRight' });
  expect(thumb.value).toBe('10');
  fireEvent.keyDown(thumb, { key: 'ArrowLeft', code: 'ArrowLeft' });
  expect(thumb.value).toBe('5');
  expect(document.activeElement).toBe(thumb);
});
