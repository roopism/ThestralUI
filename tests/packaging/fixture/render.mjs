import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import Probe from './probe.mjs';
process.stdout.write(renderToString(createElement(Probe)));
