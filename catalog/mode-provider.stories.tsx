import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Button } from '@ui-lazy-dev/ui-web';
import { ModeProvider } from '@ui-lazy-dev/ui-web/modes';
import { Stack, Surface, Text } from '@ui-lazy-dev/ui-web/primitives';
import '@ui-lazy-dev/ui-web/primitives.css';

export default { title: 'Themes/Reading list', component: ModeProvider } satisfies Meta<typeof ModeProvider>;

export const ReadingList: StoryObj = {
  render: function ReadingList() {
    const [saved, setSaved] = useState(false);
    return <main className="catalog">
      <Surface><Stack gap="md" align="start">
        <h1>Reading list</h1>
        <Text>Field notes on accessible design</Text>
        <Button aria-pressed={saved} onClick={() => setSaved(!saved)}>
          {saved ? 'Remove from reading list' : 'Save to reading list'}
        </Button>
        <span role="status">{saved ? 'Saved to your list' : ''}</span>
      </Stack></Surface>
    </main>;
  },
};
