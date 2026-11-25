import type { Meta, StoryObj } from '@storybook/react-vite';
import { useId, useState } from 'react';
import { ResourceCard } from '@ui-lazy-dev/ui-web/patterns';
import { AdaptiveGrid } from '@ui-lazy-dev/ui-web';
import './shortlist.css';

const meta = {
  title: 'Patterns/OpportunityShortlist',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;
export default meta;

function OpportunityCard({
  role,
  company,
  location,
  palette,
}: {
  role: string;
  company: string;
  location: string;
  palette: 'ink' | 'orchid';
}) {
  const [saved, setSaved] = useState(false);
  return (
    <ResourceCard
      className="opportunity"
      data-palette={palette}
      title={role}
      metadata={company + ' · ' + location}
      selected={saved}
      onSelectedChange={setSaved}
      actionText={saved ? 'Saved' : 'Save role'}
      actionLabel={'Save ' + role}
      artwork={<div className="opportunity-print" aria-hidden="true" />}
      bodyClassName="opportunity-copy"
    />
  );
}

export const Adaptive: StoryObj<typeof meta> = {
  render: function Shortlist() {
    const title = useId();
    return (
      <main className="shortlist-page">
        <section className="shortlist" aria-labelledby={title}>
          <h1 id={title}>Opportunity shortlist</h1>
          <AdaptiveGrid>
            <OpportunityCard
              role="Design engineer"
              company="Tandem Studio"
              location="Remote"
              palette="ink"
            />
            <OpportunityCard
              role="Product designer"
              company="Field Office"
              location="Bengaluru"
              palette="orchid"
            />
          </AdaptiveGrid>
        </section>
      </main>
    );
  },
};
