import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Button } from '@ui-lazy-dev/ui-web';
import webPackage from '../packages/web/package.json';
import { FieldExample, DialogExample } from './examples';
const meta = { title: 'Library', parameters: { layout: 'fullscreen' } } satisfies Meta;
export default meta;
export const Overview: StoryObj<typeof meta> = {
  render: function Overview() {
    const [dark, setDark] = useState(false);
    return (
      <main className="catalog" data-uld-theme={dark ? 'dark' : 'light'}>
        <code>@ui-lazy-dev / v{webPackage.version}</code>
        <h1>Component library</h1>
        <p>
          Accessible web components from ThestralUI. Explore their forms, interaction states and
          keyboard behavior.
        </p>
        <Button tone="secondary" aria-pressed={dark} onClick={() => setDark(!dark)}>
          Dark theme
        </Button>
        <div className="component-grid">
          <section>
            <h2>Button</h2>
            <p>Pending actions stay named and prevent repeat submissions.</p>
            <div className="actions">
              <Button>Continue</Button>
              <Button busy>Saving</Button>
            </div>
          </section>
          <section>
            <h2>Form field</h2>
            <FieldExample />
          </section>
          <section>
            <h2>Dialog</h2>
            <p>Escape closes the dialog and restores focus to its opener.</p>
            <DialogExample />
          </section>
        </div>
        <code>@ui-lazy-dev/tokens · @ui-lazy-dev/ui-web</code>
      </main>
    );
  },
};
