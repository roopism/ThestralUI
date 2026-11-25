import type axe from 'axe-core';

declare global {
  interface Window {
    /** Available after the browser fixture injects axe.source. */
    axe: typeof axe;
  }
}
