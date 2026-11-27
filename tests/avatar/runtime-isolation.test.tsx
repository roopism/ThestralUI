import { afterEach, expect, test } from 'vitest';

import { render, screen, fireEvent, cleanup } from '@testing-library/react';

import { Avatar } from '../../packages/web/src/avatar';

afterEach(cleanup);

test('an invalid or unavailable avatar falls back by name and retries only a changed source', () => {
  const { rerender } = render(<Avatar name="Zoë Miles" image="data:text/plain,test" />);
  expect(screen.getByRole('img', { name: 'Zoë Miles' }).tagName).toBe('SPAN');
  rerender(<Avatar name="Zoë Miles" image="/avatars/a.jpg" />);
  fireEvent.error(screen.getByRole('img'));
  expect(screen.getByRole('img').textContent).toBe('ZM');
  rerender(<Avatar name="Zoë Miles" image="https://example.test/b.jpg" />);
  expect(screen.getByRole('img').getAttribute('src')).toBe('https://example.test/b.jpg');
});

test('initials use the first two words, whole characters and a caller fallback when given', () => {
  const { rerender } = render(<Avatar name="  Ana   María López " />);
  expect(screen.getByRole('img', { name: 'Ana María López' }).textContent).toBe('AM');
  rerender(<Avatar name="𝒵oë" />);
  expect(screen.getByRole('img').textContent).toBe('𝒵');
  rerender(<Avatar name="क्षमा" />);
  expect(screen.getByRole('img').textContent).toBe('क्ष');
  rerender(<Avatar name={'한글'.normalize('NFD')} />);
  expect(screen.getByRole('img').textContent).toBe('한'.normalize('NFD'));
  rerender(<Avatar name="Support team" fallback="?" />);
  expect(screen.getByRole('img', { name: 'Support team' }).textContent).toBe('?');
});

test('an unsafe image address never reaches the document and the named fallback is shown', () => {
  render(<Avatar name="Rae Kim" image="javascript:alert(1)" />);
  const avatar = screen.getByRole('img', { name: 'Rae Kim' });
  expect(avatar.tagName).toBe('SPAN');
  expect(avatar.textContent).toBe('RK');
  expect(document.querySelector('img')).toBeNull();
});

test('a loaded image is named by the person and stays outside the tab order', () => {
  render(<Avatar name="Ito Hana" image="https://example.test/ito.jpg" />);
  const image = screen.getByRole('img', { name: 'Ito Hana' });
  expect(image.tagName).toBe('IMG');
  expect(image.getAttribute('alt')).toBe('Ito Hana');
  expect(image.tabIndex).toBe(-1);
});
