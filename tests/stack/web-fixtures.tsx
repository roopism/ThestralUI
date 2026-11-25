import { Stack } from '@ui-lazy-dev/ui-web/primitives';
import '@ui-lazy-dev/ui-web/primitives.css';

function ChildOrder() {
  return <main><Stack><p>First</p><p>Second</p></Stack></main>;
}

export const fixtures = { 'child-order': ChildOrder };
