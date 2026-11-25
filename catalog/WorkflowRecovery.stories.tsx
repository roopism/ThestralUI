import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Button } from '@ui-lazy-dev/ui-web';
import { Input } from '@ui-lazy-dev/ui-web/forms';
import { BatchProgress, NotificationCenter, Wizard } from '@ui-lazy-dev/ui-web/workflows';
import '@ui-lazy-dev/ui-web/workflows.css';

const meta = { title: 'Enterprise/Workflow recovery', parameters: { layout: 'fullscreen' } } satisfies Meta;
export default meta;

function TransferStatus() {
  const [inboxOffline, setInboxOffline] = useState(true);
  const [batchOffline, setBatchOffline] = useState(true);
  const [read, setRead] = useState(false);
  return <main>
    <NotificationCenter label="Transfer notices" items={[{ id: 'ready', title: 'Archive ready', read }]}
      onRead={() => { /* The next refresh confirms the read. */ }}
      availability={inboxOffline ? { kind: 'error', message: 'Inbox unavailable',
        retryLabel: 'Reload inbox', onRetry: () => setInboxOffline(false) } : undefined} />
    <BatchProgress label="Transfer jobs" items={[]}
      availability={batchOffline ? { kind: 'error', message: 'Jobs unavailable',
        retryLabel: 'Reload jobs', onRetry: () => setBatchOffline(false) } : undefined} />
    {!read && <Button onClick={() => setRead(true)}>Apply refreshed inbox</Button>}
  </main>;
}

function TransferRequest() {
  const [step, setStep] = useState('details');
  const [busy, setBusy] = useState(false);
  return <main>
    <Wizard label="Request transfer" activeId={step} onStepChange={setStep} onFinish={() => setBusy(true)}
      busy={busy} steps={[
        { id: 'details', label: 'Transfer details', content: <label>Destination<Input /></label> },
        { id: 'review', label: 'Review transfer', content: <label>Confirmation note<Input /></label> },
      ]} />
  </main>;
}

export const Status: StoryObj<typeof meta> = { render: () => <TransferStatus /> };
export const Request: StoryObj<typeof meta> = { render: () => <TransferRequest /> };
