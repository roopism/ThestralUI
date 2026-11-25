import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  DocumentPreview,
  EmptyState,
  PanelHeader,
  ResourceCard,
} from '@ui-lazy-dev/ui-web/patterns';
import { Button } from '@ui-lazy-dev/ui-web';
const meta = { title: 'Patterns/Document review' } satisfies Meta;
export default meta;
export const Review: StoryObj = {
  render: function Review() {
    const [selected, setSelected] = useState(false);
    return (
      <main className="catalog">
        <h1>Document review</h1>
        <div className="component-grid">
          <ResourceCard
            title="Research proposal"
            metadata="Revision 4 · 2 pages"
            selected={selected}
            onSelectedChange={setSelected}
            actionLabel="Select research proposal"
            actionText={selected ? 'Selected' : 'Select document'}
          />
          <DocumentPreview label="Document preview">
            <PanelHeader>
              <h2>Preview</h2>
            </PanelHeader>
            {selected ? (
              <article>
                <h3>Research proposal</h3>
                <p>Compare how readers find sources in two document layouts.</p>
              </article>
            ) : (
              <EmptyState
                title="Select a document"
                headingLevel={3}
                description="Open a proposal to review its contents."
                action={<Button onClick={() => setSelected(true)}>Open proposal</Button>}
              />
            )}
          </DocumentPreview>
        </div>
      </main>
    );
  },
};
