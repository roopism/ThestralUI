import type { Meta, StoryObj } from '@storybook/react-vite';
import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@ui-lazy-dev/ui-web';
import { Dialog } from '@ui-lazy-dev/ui-web/dialog';
import { Preferences, type PreferenceArgs } from './modal-dialog/Preferences';
import { KeyboardReview, MinimalDialog, WorkspaceDialog } from './modal-dialog/Review';
import { DialogExample } from './examples';
const meta = {
  title: 'Components',
  decorators: [
    (Story) => (
      <main className="catalog">
        <div className="specimen">
          <Story />
        </div>
      </main>
    ),
  ],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Confirmation: Story = { render: DialogExample };

function EmbeddedDraftReview() {
  const [workspace, setWorkspace] = useState<Document | null>(null);
  const [open, setOpen] = useState(false);
  const [newDraft, setNewDraft] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const editorTrigger = useRef<HTMLButtonElement>(null);
  const billing = useRef<HTMLHeadingElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();

  function reviewNewDraft() {
    setNewDraft(true);
    setOpen(true);
  }

  function continueToBilling() {
    dialog.current?.close();
    billing.current?.focus();
    setOpen(false);
  }

  return (
    <>
      <Button disabled={!workspace} onClick={() => setOpen(true)}>Review embedded draft</Button>
      <iframe title="Draft workspace" srcDoc="<!doctype html><html lang='en'><title>Draft workspace</title><body></body></html>"
        onLoad={event => setWorkspace(event.currentTarget.contentDocument)} />
      {workspace && createPortal(
        <>
          {!newDraft && <Button ref={editorTrigger} onClick={() => setOpen(true)}>Edit draft</Button>}
          <Button onClick={reviewNewDraft}>Review new draft</Button>
          {newDraft && <h2 ref={billing} tabIndex={-1}>Billing</h2>}
          {open && (
            <Dialog labelledBy={title} ref={dialog} returnFocusRef={newDraft ? editorTrigger : { current: editorTrigger.current }} onDismiss={() => setOpen(false)}>
              <h2 id={title}>Review changes</h2>
              <Button onClick={() => setOpen(false)}>Return to editor</Button>
              <Button aria-expanded={detailsOpen} onClick={() => setDetailsOpen(!detailsOpen)}>Review details</Button>
              {detailsOpen && <p>The draft includes changes to the billing address.</p>}
              {newDraft && <Button onClick={continueToBilling}>Continue to billing</Button>}
            </Dialog>
          )}
        </>,
        workspace.body,
      )}
    </>
  );
}

export const EmbeddedDraft: Story = { render: EmbeddedDraftReview };

export const KeyboardEditing: Story = { render: () => <KeyboardReview /> };
export const MinimalReview: Story = { render: () => <MinimalDialog /> };
export const DraftWorkspace: StoryObj<{ unstyledConfirmation: boolean }> = {
  args: { unstyledConfirmation: false }, render: args => <WorkspaceDialog {...args} />,
};

export const PreferencePanel: StoryObj<PreferenceArgs> = {
  args: { mode: 'light', scheme: 'light', brand: 'enterprise', density: 'comfortable', size: 'md', unstyled: false, veto: false, backdrop: true, direction: 'ltr', long: false },
  argTypes: {
    mode: { control: 'select', options: ['light', 'dark'] },
    scheme: { control: 'select', options: ['light', 'dark', 'high-contrast'] },
    brand: { control: 'select', options: ['enterprise', 'expressive'] },
    density: { control: 'select', options: ['compact', 'comfortable', 'spacious'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    direction: { control: 'select', options: ['ltr', 'rtl'] },
  },
  render: args => <Preferences {...args} />,
};
