import { createElement, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';

type Fixtures = Readonly<Record<string, ComponentType>>;

// The runner sets this to the requested family's module before esbuild resolves imports.
declare const ULD_WEB_FIXTURE: string;
export async function mount(slug: string, key: string) {
  let module: { fixtures: Fixtures };
  try {
    module = await import(ULD_WEB_FIXTURE);
  } catch (cause) {
    throw new Error('Could not load web fixtures for ' + slug, { cause });
  }
  if (!module.fixtures || !Object.hasOwn(module.fixtures, key))
    throw Error('Unknown web fixture ' + slug + '/' + key);
  createRoot(document.getElementById('app')!).render(createElement(module.fixtures[key]));
}
