import { Heading, Keyboard, Separator } from '@ui-lazy-dev/ui-web/document';
import { CodeField, FileUpload } from '@ui-lazy-dev/ui-web/entry-fields';
import { DocumentPreview, EmptyState, PanelHeader } from '@ui-lazy-dev/ui-web/patterns';
import { AppShell, AppNavigation, WorkspacePage } from '@ui-lazy-dev/ui-web/workflows';
import { DialogActions, DialogBody, DialogHeading } from '@ui-lazy-dev/ui-web/modal-dialog';
import { KeyboardShortcutLabel, useKeyboardShortcutLabel, getKeyboardShortcutLabelProps } from '@ui-lazy-dev/ui-web/keyboard-shortcut-label';
import { ModeProvider } from '@ui-lazy-dev/ui-web/modes';
import { AdaptiveGrid, Button, FormField } from '@ui-lazy-dev/ui-web';
import {
  Badge, Box, ButtonGroup, Divider, Grid, Icon, Inline, Progress, ScrollArea,
  Skeleton, Spinner, Stack, Status, Surface, Text,
} from '@ui-lazy-dev/ui-web/primitives';

export default function FoundationsPage() {
  const nextKey = useKeyboardShortcutLabel({ keys: 'Tab' });
  const priorKey = getKeyboardShortcutLabelProps({ keys: ['Shift', 'Tab'] });
  return <AppShell skipLabel="Skip to reading list" navigationLabel="Book navigation"
    navigation={<AppNavigation items={[{ id: 'contents', href: '#contents', label: 'Contents' }]} currentId="contents" />}>
    <WorkspacePage title="Reading room" description="Review and save reading progress">
    <Heading level={1}>Reading progress</Heading>
    <ModeProvider brand="enterprise" density="compact" scheme="dark">
      <Surface>
        <Stack gap="md">
          <Box><Text>Reading list</Text></Box>
          <Inline gap="sm"><Icon label="Book"><span>▤</span></Icon><Badge>Reference</Badge></Inline>
          <Divider />
          <Separator orientation="vertical" aria-label="Reading tools divider" />
          <Keyboard aria-label="Print shortcut">⌘P</Keyboard>
          <p>Find a passage with <KeyboardShortcutLabel keys={['Ctrl', 'F']} spokenLabel="Control F" />.</p>
          <p>Move forward with <kbd {...nextKey.kbdProps}>{nextKey.keys.join(nextKey.separator)}</kbd>
            {' '}or backward with <kbd {...priorKey.kbdProps}>{priorKey.keys.join(priorKey.separator)}</kbd>.</p>
          <PanelHeader id="contents">Reading tools</PanelHeader>
          <DocumentPreview label="Manuscript preview">Chapter one</DocumentPreview>
          <dialog open aria-labelledby="reading-summary">
            <DialogHeading id="reading-summary">Reading summary</DialogHeading>
            <DialogBody>You have read three pages.</DialogBody>
            <DialogActions><a href="#contents">Return to reading tools</a></DialogActions>
          </dialog>
          <EmptyState title="No annotations" description="Annotations appear here." />
          <CodeField label="Book code" digits={4} defaultValue="1234" />
          <FileUpload label="Attach manuscript" />
          <AdaptiveGrid><Grid><Text>Chapter one</Text></Grid></AdaptiveGrid>
          <ScrollArea label="Chapters"><Text>Performance and accessibility</Text></ScrollArea>
          <Progress label="Pages read" value={3} max={10} />
          <Status>Three pages read</Status>
          <Skeleton aria-hidden="true" /><Spinner label="Loading illustration" />
          <FormField label="Bookmark" hint="Use a short title"><input defaultValue="Chapter one" /></FormField>
          <ButtonGroup label="Book actions"><Button>Print chapter</Button></ButtonGroup>
        </Stack>
      </Surface>
    </ModeProvider>
    </WorkspacePage>
  </AppShell>;
}
