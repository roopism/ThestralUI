import { useId, useRef, useState } from 'react';
import { Button } from '@ui-lazy-dev/ui-web';
import { Checkbox } from '@ui-lazy-dev/ui-web/forms';
import '@ui-lazy-dev/ui-web/controls.css';
import { Dialog, DialogActions, DialogBody, DialogHeading, type DialogProps } from '@ui-lazy-dev/ui-web/modal-dialog';

export interface PreferenceArgs {
  mode: 'light' | 'dark';
  scheme: 'light' | 'dark' | 'high-contrast';
  brand: 'enterprise' | 'expressive';
  density: 'compact' | 'comfortable' | 'spacious';
  size: DialogProps['size'];
  unstyled: boolean;
  veto: boolean;
  backdrop: boolean;
  direction: 'ltr' | 'rtl';
  long: boolean;
}

export function Preferences({ mode, scheme, brand, density, size, unstyled, veto, backdrop, direction, long }: PreferenceArgs) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [requests, setRequests] = useState(0);
  const openButton = useRef<HTMLButtonElement>(null);
  const previewButton = useRef<HTMLButtonElement>(null);
  const title = useId();
  const description = useId();
  function show(fromPreview: boolean) { setPreview(fromPreview); setOpen(true); }
  function requestDismiss() { setRequests(n => n + 1); if (!veto) setOpen(false); }
  return <section dir={direction} data-uld-theme={mode} data-uld-scheme={scheme} data-uld-brand={brand} data-uld-density={density}>
    <h2>Notification preferences</h2>
    <div className="actions">
      <Button ref={openButton} onClick={() => show(false)}>Open preferences</Button>
      <Button ref={previewButton} onClick={() => show(true)}>Preview preferences</Button>
    </div>
    {veto && <p>Dismissal requests <output aria-label="Dismissal requests">{requests}</output></p>}
    <Dialog open={open} labelledBy={title} describedBy={description} size={size} unstyled={unstyled}
      returnFocusRef={preview ? previewButton : openButton} onDismiss={requestDismiss} dismissOnBackdrop={backdrop} className="preference-dialog">
      <DialogHeading id={title}>Notification delivery</DialogHeading>
      <DialogBody>
        <p id={description}>Choose how to receive updates about your workspace.</p>
        <div className="uld-controls"><Checkbox defaultSelected>Weekly summary</Checkbox></div>
        {long && <div lang="ja">{Array.from({ length: 16 }, (_, i) => <p key={i}>更新通知の詳細設定を確認してください。ワークスペースの変更を週ごとにまとめます。</p>)}</div>}
      </DialogBody>
      <DialogActions><Button onClick={() => setOpen(false)}>Done</Button></DialogActions>
    </Dialog>
  </section>;
}
