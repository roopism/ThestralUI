import { useState } from 'react';
import type { StoryObj } from '@storybook/react-vite';
import { Button } from '@ui-lazy-dev/ui-web';
import { ButtonGroup, IconButton, Stack, Status } from '@ui-lazy-dev/ui-web/primitives';
import '@ui-lazy-dev/ui-web/styles.css';
import '@ui-lazy-dev/ui-web/primitives.css';

export default { title: 'Actions/Review decisions' };

function ReviewActions() {
  const [decision, setDecision] = useState('Awaiting review');
  return (
    <main className="catalog">
      <Stack>
        <h1>Document review</h1>
        <Status>{decision}</Status>
        <ButtonGroup label="Review decisions">
          <Button size="sm" tone="secondary" onClick={() => setDecision('Changes requested')}>
            Request changes
          </Button>
          <Button size="md" startIcon={<span>✓</span>} onClick={() => setDecision('Approved')}>
            Approve
          </Button>
          <Button size="lg" endIcon={<span>→</span>} onClick={() => setDecision('Published')}>
            Publish
          </Button>
          <IconButton
            size="sm"
            tone="secondary"
            label="Reset review decision"
            onClick={() => setDecision('Awaiting review')}
          >
            ↶
          </IconButton>
        </ButtonGroup>
      </Stack>
    </main>
  );
}

export const Decisions: StoryObj = { render: () => <ReviewActions /> };
