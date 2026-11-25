import { createElement, Suspense, use, type ReactNode } from 'react';
import { renderToPipeableStream } from 'react-dom/server';
import { PassThrough } from 'node:stream';
import { useLocale } from 'react-aria-components';
import { I18nProvider } from '@ui-lazy-dev/ui-web/navigation';
import { ModeProvider } from '@ui-lazy-dev/ui-web/modes';
import { PasswordField } from '@ui-lazy-dev/ui-web/entry-fields';

export function modeProps(locale: string, direction: 'ltr' | 'rtl') {
  const theme = locale === 'ar' ? 'dark' : 'light';
  return {
    lang: locale, dir: direction, scheme: theme, brand: locale === 'ar' ? 'expressive' : 'enterprise',
    'data-uld-theme': theme,
  } as const;
}
export function passwordFields(prefix: string) {
  return [1, 2].map(i => createElement(PasswordField, {
    key: i, name: 'pin' + i, label: prefix + ' ' + i, hint: prefix + ' hint',
    revealLabel: prefix + ' reveal ' + i, concealLabel: prefix + ' hide ' + i,
  }));
}
function ServerFields() {
  const { locale, direction } = useLocale();
  return createElement(ModeProvider, modeProps(locale, direction), passwordFields(locale));
}
function fields(prefix: string) {
  return createElement(I18nProvider, { locale: prefix, children: createElement(ServerFields) });
}

function suspend() {
  let finish!: () => void;
  const wait = new Promise<void>(resolve => { finish = resolve; });
  return { wait, finish };
}
function After({ wait, children }: { wait: Promise<void>; children?: ReactNode }) {
  use(wait);
  return children;
}
function start(prefix: string, block: Promise<void>) {
  const ready = suspend(), out = new PassThrough();
  out.setEncoding('utf8');
  let body = '';
  const result = new Promise<string>((resolve, reject) => {
    out.on('data', chunk => { body += chunk; });
    out.once('end', () => resolve(body));
    out.once('error', reject);
  });
  const stream = renderToPipeableStream(
    createElement(Suspense, { fallback: null }, createElement(After, { wait: block }, fields(prefix))),
    { identifierPrefix: prefix, onShellReady: ready.finish, onAllReady: () => stream.pipe(out),
      onError: error => { out.destroy(error instanceof Error ? error : new Error(String(error))); } },
  );
  return { ready: ready.wait, result };
}

// The real server and browser have separate React contexts. Both requests still share one server.
if (import.meta.main) {
  const ar = suspend(), ja = suspend();
  const a = start('ar', ar.wait), b = start('ja', ja.wait);
  await Promise.all([a.ready, b.ready]);
  ja.finish();
  const second = await b.result;
  ar.finish();
  const first = await a.result;
  process.stdout.write(JSON.stringify([first, second]));
}
