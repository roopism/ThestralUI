import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, FormField } from '@ui-lazy-dev/ui-web';
import { Input } from '@ui-lazy-dev/ui-web/forms';
import { Drawer } from '@ui-lazy-dev/ui-web/motion';
import { Avatar } from '@ui-lazy-dev/ui-web/avatar';
import { Stack, Surface } from '@ui-lazy-dev/ui-web/primitives';
import '@ui-lazy-dev/ui-web/motion.css';
import '@ui-lazy-dev/ui-web/primitives.css';

const meta = { title: 'Quality/DraftReview', parameters: { layout: 'fullscreen' } } satisfies Meta;
export default meta;
type Pending = { id: number; resolve(): void; reject(): void };
type Submit = (title: string) => Promise<void>;

function Editor({
  saved,
  submit,
  onSave,
}: {
  saved: string;
  submit: Submit;
  onSave(title: string): void;
}) {
  const [draft, setDraft] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const invoker = useRef<HTMLButtonElement>(null);
  const active = useRef<symbol | null>(null);
  useEffect(
    () => () => {
      active.current = null;
    },
    [],
  );
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (active.current) return;
    const request = Symbol('request');
    active.current = request;
    setBusy(true);
    setError('');
    try {
      await submit(draft);
      if (active.current === request) onSave(draft);
    } catch {
      if (active.current === request) setError('Save failed. Your draft is available to retry.');
    } finally {
      if (active.current === request) {
        active.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <Surface>
      <form
        onSubmit={save}
        onReset={(event) => {
          event.preventDefault();
          setDraft(saved);
          setError('');
        }}
      >
        <FormField label="Draft title" error={error || undefined}>
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} readOnly={busy} />
        </FormField>
        <Button type="submit" busy={busy}>
          Save draft
        </Button>
        <Button type="reset" disabled={busy}>
          Reset draft
        </Button>
        {busy && (
          <Button
            onClick={() => {
              active.current = null;
              setBusy(false);
            }}
          >
            Cancel save
          </Button>
        )}
      </form>
      <Button ref={invoker} onClick={() => setPreview(true)}>
        Preview draft
      </Button>
      {preview && (
        <Drawer
          title="Draft preview"
          closeLabel="Close preview"
          onDismiss={() => setPreview(false)}
          returnFocusRef={invoker}
        >
          {draft || 'Untitled draft'}
        </Drawer>
      )}
    </Surface>
  );
}

function Review() {
  const [saved, setSaved] = useState('First draft');
  const [open, setOpen] = useState(true);
  const [pending, setPending] = useState<Pending[]>([]);
  const next = useRef(0);
  const submit: Submit = () =>
    new Promise<void>((resolve, reject) => {
      const id = ++next.current;
      setPending((list) => [...list, { id, resolve, reject }]);
    });
  function settle(request: Pending, success: boolean) {
    setPending((items) => items.filter((item) => item !== request));
    if (success) request.resolve();
    else request.reject();
  }
  return (
    <main className="catalog" data-uld-theme="light">
      <Stack>
        <h1>Draft review</h1>
        <Button onClick={() => setOpen((value) => !value)}>
          {open ? 'Close editor' : 'Open editor'}
        </Button>
        {open && <Editor saved={saved} submit={submit} onSave={setSaved} />}
        <output aria-label="Requests created">{next.current}</output>
        <output aria-label="Last saved title">{saved}</output>
        {pending.map((request) => (
          <div key={request.id}>
            <Button onClick={() => settle(request, true)}>Resolve request {request.id}</Button>
            <Button onClick={() => settle(request, false)}>Fail request {request.id}</Button>
          </div>
        ))}
        <Surface
          role="region"
          aria-label="Regional proof"
          data-uld-theme="dark"
          lang="ar"
          dir="rtl"
        >
          <h2>مراجعة المستندات</h2>
          <Avatar name="Mina Chen" image="/__quality/absent-portrait.png" />
          <bdi>نسخة-東京-v2.pdf</bdi>
          <p role="status">
            {new Intl.PluralRules('ar').select(2) === 'two' ? 'مستندان' : 'مستندات'} ·{' '}
            {new Intl.NumberFormat('ar-EG').format(1200)}
          </p>
          <time dateTime="2026-11-20">
            {new Intl.DateTimeFormat('ar-EG', { dateStyle: 'long', timeZone: 'UTC' }).format(
              Date.UTC(2026, 10, 20),
            )}
          </time>
        </Surface>
      </Stack>
    </main>
  );
}
export const Interactive: StoryObj<typeof meta> = { render: () => <Review /> };
