import { type FormEvent, useState } from 'react';
import type { StoryObj } from '@storybook/react-vite';
import { Button, FormField } from '@ui-lazy-dev/ui-web';
import { Input } from '@ui-lazy-dev/ui-web/forms';
import '@ui-lazy-dev/ui-web/styles.css';

export default {
  title: 'Actions/Button states',
  args: { mode: 'light' },
  argTypes: {
    mode: { control: 'select', options: ['light', 'dark'] },
    scheme: { control: 'select', options: ['light', 'dark', 'high-contrast'] },
    brand: { control: 'select', options: ['enterprise', 'expressive'] },
    density: { control: 'select', options: ['compact', 'comfortable', 'spacious'] },
  },
};

const tones = ['primary', 'secondary', 'ghost', 'danger', 'link'] as const;
const label = { primary: 'Publish', secondary: 'Preview', ghost: 'Skip', danger: 'Delete', link: 'Learn more' };

interface Modes {
  mode: 'light' | 'dark';
  scheme?: 'light' | 'dark' | 'high-contrast';
  brand?: 'enterprise' | 'expressive';
  density?: 'compact' | 'comfortable' | 'spacious';
}

function Matrix({ mode, scheme, brand, density }: Modes) {
  const [plainBusy, setPlainBusy] = useState(false);
  return (
    <main
      className="catalog"
      data-uld-theme={mode}
      data-uld-scheme={scheme}
      data-uld-brand={brand}
      data-uld-density={density}
    >
      <h1>Button tones and states</h1>
      {tones.map((tone) => (
        <section key={tone} aria-label={tone}>
          <h2>{tone}</h2>
          <div className="actions">
            <Button tone={tone}>{label[tone]}</Button>
            <Button tone={tone} busy>
              {label[tone] + ' busy'}
            </Button>
            <Button tone={tone} disabled>
              {label[tone] + ' disabled'}
            </Button>
          </div>
        </section>
      ))}
      <Button fullWidth size="lg" startIcon={<span>✓</span>}>
        Confirm order
      </Button>
      <Button unstyled className="app-action" busy={plainBusy} onClick={() => setPlainBusy(true)}>
        Unstyled action
      </Button>
    </main>
  );
}

function PendingSave() {
  const [submits, setSubmits] = useState(0);
  const [busy, setBusy] = useState(false);
  function save(event: FormEvent) {
    event.preventDefault();
    setSubmits((count) => count + 1);
    setBusy(true);
  }
  return (
    <main className="catalog">
      <h1>Pending save</h1>
      <form onSubmit={save}>
        <FormField label="Title">
          <Input name="title" defaultValue="Quarterly report" />
        </FormField>
        <Button type="submit" busy={busy}>
          Save draft
        </Button>
        <Button tone="secondary" onClick={() => setBusy(false)}>
          Finish saving
        </Button>
      </form>
      <output aria-label="Submissions">{submits}</output>
    </main>
  );
}

export const Tones: StoryObj<Modes> = {
  render: (modes) => <Matrix {...modes} />,
};

export const Pending: StoryObj = { render: () => <PendingSave /> };
