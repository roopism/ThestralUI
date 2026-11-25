import { createElement } from 'react';
import { hydrateRoot } from 'react-dom/client';
import Probe from './probe.mjs';
hydrateRoot(document.querySelector('#root'), createElement(Probe), {
  onRecoverableError(error) { console.error(error); },
});
