import { type ReactNode, useId, useRef, useState } from 'react';
import { Button } from '@ui-lazy-dev/ui-web';
import { Input, Label, TextArea, TextField } from '@ui-lazy-dev/ui-web/forms';
import { Dialog, DialogActions, DialogBody, DialogHeading } from '@ui-lazy-dev/ui-web/modal-dialog';
import '@ui-lazy-dev/ui-web/styles.css';

export function MinimalDialog() {
  const title = useId();
  const launcher = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const close = () => { setOpen(false); setMessage('Dialog closed'); };
  return <>
    <Button ref={launcher} onClick={() => setOpen(true)}>Open dialog</Button>
    <output aria-live="polite">{message}</output>
    <Dialog open={open} labelledBy={title} returnFocusRef={launcher} onDismiss={close}>
      <DialogHeading id={title}>Change review</DialogHeading>
      <DialogBody><p>Review changes</p></DialogBody>
      <DialogActions><Button onClick={close}>Close dialog</Button></DialogActions>
    </Dialog>
  </>;
}

export function WorkspaceDialog({ unstyledConfirmation = false }: { unstyledConfirmation?: boolean } = {}) {
  const outerTitle = useId();
  const innerTitle = useId();
  const description = useId();
  const launcher = useRef<HTMLButtonElement>(null);
  const details = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [draft, setDraft] = useState('Quarterly review');
  const [message, setMessage] = useState('');
  const close = () => { setOpen(false); setMessage('Workspace resumed'); };
  return <>
    <Button ref={launcher} onClick={() => setOpen(true)}>Review changes</Button>
    <output aria-live="polite">{message}</output>
    {open && <Dialog labelledBy={outerTitle} describedBy={description} returnFocusRef={launcher} onDismiss={close} size="lg">
      <DialogHeading id={outerTitle}>Workspace review</DialogHeading>
      <DialogBody>
        <p id={description}>Review draft</p>
        <TextField value={draft} onChange={setDraft}><Label>Draft title</Label> <Input /></TextField>
      </DialogBody>
      <DialogActions>
        <Button ref={details} onClick={() => setConfirming(true)}>Review details</Button>
        <Button tone="secondary" onClick={close}>Back to workspace</Button>
      </DialogActions>
      {confirming && <Dialog labelledBy={innerTitle} role="alertdialog" size="sm" dismissOnBackdrop unstyled={unstyledConfirmation}
        returnFocusRef={details} onDismiss={() => setConfirming(false)}>
        <DialogHeading id={innerTitle}>Confirm discard</DialogHeading>
        <DialogBody><p>Discard draft?</p></DialogBody>
        <DialogActions>
          <Button autoFocus onClick={() => setConfirming(false)}>Keep editing</Button>
          <Button tone="danger" onClick={() => { setDraft(''); setConfirming(false); }}>Discard draft</Button>
        </DialogActions>
      </Dialog>}
    </Dialog>}
  </>;
}

/** A keyboard-only review, including unavailable controls that must never become tab stops. */
export function KeyboardReview({ editor }: { editor?: ReactNode } = {}) {
  const title = useId();
  const launcher = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return <>
    <Button ref={launcher} onClick={() => setOpen(true)}>Edit review notes</Button>
    {open && <Dialog labelledBy={title} returnFocusRef={launcher} onDismiss={() => setOpen(false)}>
      <DialogHeading id={title}>Review notes</DialogHeading>
      <DialogBody>
        <Button hidden>Hidden action</Button>
        <div inert><Button>Inactive action</Button></div>
        <fieldset disabled><Button>Unavailable action</Button></fieldset>
        {editor ?? <TextArea aria-label="Reviewer notes" />}
      </DialogBody>
      <DialogActions><Button onClick={() => setOpen(false)}>Finish review</Button></DialogActions>
    </Dialog>}
  </>;
}
