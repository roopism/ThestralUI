import { useState } from 'react';
import { Button } from '@ui-lazy-dev/ui-web';
import '@ui-lazy-dev/ui-web/styles.css';

function SaveOnce() {
  const [count, setCount] = useState(0);
  return <main>
    <Button onClick={() => setCount(value => value + 1)}>Save</Button>
    <p>{count === 1 ? 'Saved once' : count + ' saves'}</p>
  </main>;
}

function PendingOnce() {
  const [count, setCount] = useState(0);
  return <main>
    <Button busy={count > 0} onClick={() => setCount(value => value + 1)}>Save</Button>
    <p>{count === 1 ? 'Saved once' : count + ' saves'}</p>
  </main>;
}

function DisabledSkip() {
  const [archived, setArchived] = useState(false);
  return <main>
    <Button disabled onClick={() => setArchived(true)}>Archive</Button>
    <p>{archived ? 'Archived' : 'Not archived'}</p>
  </main>;
}

export const fixtures = { 'save-once': SaveOnce, 'pending-once': PendingOnce, 'disabled-skip': DisabledSkip };
