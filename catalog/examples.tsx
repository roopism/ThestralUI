import { useId, useState } from 'react';
import { Button, FormField } from '@ui-lazy-dev/ui-web';
import { Dialog } from '@ui-lazy-dev/ui-web/dialog';
export function DialogExample() {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open dialog</Button>
      {open && (
        <Dialog labelledBy={id} onDismiss={() => setOpen(false)} dismissOnBackdrop>
          <h2 id={id}>Discard changes?</h2>
          <p>Discard the unsaved changes in this example.</p>
          <div className="actions">
            <Button tone="secondary" autoFocus onClick={() => setOpen(false)}>
              Keep editing
            </Button>
            <Button onClick={() => setOpen(false)}>Discard</Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
export function FieldExample() {
  const [value, setValue] = useState(''),
    [checked, setChecked] = useState(false);
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setChecked(true);
      }}
    >
      <FormField
        label="Workspace name"
        hint="Use at least three characters."
        error={checked && value.trim().length < 3 ? 'Enter at least three characters.' : undefined}
      >
        <input value={value} onChange={(e) => setValue(e.target.value)} required minLength={3} />
      </FormField>
      <p>
        <Button type="submit">Validate name</Button>
      </p>
    </form>
  );
}
