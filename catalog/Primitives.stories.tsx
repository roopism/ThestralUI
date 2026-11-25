import type { StoryObj } from '@storybook/react-vite';
import { Avatar } from '@ui-lazy-dev/ui-web/avatar';
import { Badge, ButtonGroup, IconButton, Progress, Stack, Status, Surface } from '@ui-lazy-dev/ui-web/primitives';
import '@ui-lazy-dev/ui-web/primitives.css';
export default { title: 'Atoms/Status and actions' };
export const Review: StoryObj = {
  render: () => (
    <main className="catalog">
      <Surface>
        <h1>Review queue</h1>
        <Stack>
          <Avatar name="Nora Lee" />
          <Badge>In review</Badge>
          <Progress label="Documents checked" value={3} max={5} />
          <Status>Three documents checked</Status>
          <ButtonGroup label="Review actions">
            <IconButton label="Print" onClick={() => window.print()}>
              ⎙
            </IconButton>
          </ButtonGroup>
        </Stack>
      </Surface>
    </main>
  ),
};
