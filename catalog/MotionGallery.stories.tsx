import type { Meta, StoryObj } from '@storybook/react-vite';
import { useLayoutEffect, useRef, useState } from 'react';
import {
  AlertDialog,
  Carousel,
  createToastQueue,
  Drawer,
  ExpandableMediaCard,
  GestureSheet,
  ToastRegion,
} from '@ui-lazy-dev/ui-web/motion';
import '@ui-lazy-dev/ui-web/motion.css';

type GalleryMode = 'light' | 'dark';
const meta = {
  title: 'Patterns/PublicationLibrary',
  args: { mode: 'light' as GalleryMode },
  argTypes: { mode: { control: 'select', options: ['light', 'dark'] } },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<{ mode: GalleryMode }>;
export default meta;

const titles = [
  {
    id: 'currents',
    title: 'Currents',
    author: 'Lena Osei',
    topic: 'Environment',
    detail: 'Field recordings and quiet observations follow a river from its source to the coast.',
  },
  {
    id: 'after-hours',
    title: 'After Hours',
    author: 'Nico Vale',
    topic: 'Architecture',
    detail:
      'A photographic essay on the buildings, kitchens and corner stores that keep a city awake.',
  },
  {
    id: 'fieldwork',
    title: 'Fieldwork',
    author: 'Imani Cho',
    topic: 'Environment',
    detail: 'A series of illustrated interviews with growers on the changing edges of the city.',
  },
];

const labels = {
  carousel: 'carousel',
  slide: 'slide',
  previous: 'Previous title',
  next: 'Next title',
  position: (n: number, total: number) => n + ' of ' + total,
};

const styles = `
  .publication-library { box-sizing: border-box; min-height: 100dvh; padding: clamp(1rem, 5vw, 4rem); background: var(--uld-canvas); color: var(--uld-text); font-family: system-ui, sans-serif; }
  .publication-library * { box-sizing: border-box; }
  .publication-wrap { max-width: 56rem; margin: auto; display: grid; gap: 1rem; }
  .publication-intro { display: flex; align-items: end; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
  .publication-intro h1 { margin: 0; overflow-wrap: anywhere; font-size: clamp(1.9rem, 6vw, 3.25rem); line-height: 1.04; letter-spacing: -.045em; }
  .publication-intro nav, .publication-library menu { display: flex; align-items: center; flex-wrap: wrap; gap: .5rem; padding: 0; margin: 0; }
  .publication-library li { list-style: none; }
  .publication-choice { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: .5rem 0; }
  .publication-library .uld-media-details { line-height: 1.5; }
  .publication-library .uld-media-details p { max-width: 60ch; }
  .publication-cover { position: relative; isolation: isolate; overflow: hidden; display: flex; align-items: flex-end; padding: 5%; color: #fff; background: #27453c; }
  .publication-cover b { font: 650 clamp(1.5rem, 5vw, 3rem)/1 system-ui, sans-serif; letter-spacing: -.04em; }
  .publication-cover::before { content: ''; position: absolute; inset: -25%; z-index: -1; opacity: .5; background: repeating-linear-gradient(112deg, transparent 0 1.4rem, #85aca0 1.42rem 1.47rem); }
  .publication-library[data-direction="editorial"] { --uld-canvas: #f1eade; --uld-surface: #fff8ed; --uld-text: #26201d; --uld-muted: #655348; --uld-border: #b5a999; --uld-focus: #8b3300; --uld-radius: 1.2rem; --uld-radius-lg: 1rem; }
  .publication-library[data-direction="editorial"] h1 { font-family: Georgia, serif; font-weight: 500; font-size: clamp(2.5rem, 8vw, 5rem); }
  .publication-library[data-direction="editorial"] .publication-cover b { font: italic 600 clamp(2.2rem, 9vw, 5.8rem)/.9 Georgia, serif; }
  .publication-library[data-direction="editorial"] .publication-cover { color: #252531; background: #f1b98a; }
  .publication-library[data-direction="editorial"] .publication-cover::before { opacity: 1; inset: -110% -50% -18% 25%; transform: rotate(-15deg); border-radius: 45%; background: repeating-radial-gradient(ellipse at center, #f3877e 0 6%, #f6b694 6.5% 11%, #8b4367 11.5% 13%); }
  .publication-library[data-direction="editorial"] .publication-cover[data-cover="after-hours"] { background: #181d40; color: #fff4c5; }
  .publication-library[data-direction="editorial"] [data-cover="after-hours"]::before { inset: -70% -25% -60% 45%; transform: rotate(24deg); border-radius: 0; background: repeating-linear-gradient(90deg, #404e8b 0 6%, #a595c4 6.5% 8%, #1b274a 8.5% 11%); }
  .publication-library[data-direction="editorial"] .publication-cover[data-cover="fieldwork"] { background: #c5cf93; color: #172e27; }
  .publication-library[data-direction="editorial"] [data-cover="fieldwork"]::before { inset: -40% -8% -40% 55%; background: repeating-radial-gradient(circle, #235547 0 7%, #acc886 7.5% 13%); }
  .publication-cover b { background: inherit; padding: .06em .14em .11em; }
  .publication-library[data-direction="editorial"][data-uld-theme="dark"] { --uld-canvas: #211d21; --uld-surface: #2e282c; --uld-text: #fff2de; --uld-muted: #dbbcac; --uld-border: #796967; --uld-focus: #ffbf8f; }
  @media (max-width: 28rem) { .publication-library .uld-carousel-controls { flex-wrap: wrap; } }
  @media (forced-colors: active) { .publication-library .publication-cover { border: 1px solid CanvasText; } .publication-cover::before { display: none; } }
`;

function PublicationLibrary({
  direction,
  mode,
}: {
  direction: 'enterprise' | 'editorial';
  mode: GalleryMode;
}) {
  const browseTrigger = useRef<HTMLButtonElement>(null);
  const listTrigger = useRef<HTMLButtonElement>(null);
  const removeTrigger = useRef<HTMLButtonElement | null>(null);
  useLayoutEffect(() => {
    const root = document.documentElement;
    const previous = root.getAttribute('data-uld-theme');
    root.setAttribute('data-uld-theme', mode);
    return () => {
      if (previous) root.setAttribute('data-uld-theme', previous);
      else root.removeAttribute('data-uld-theme');
    };
  }, [mode]);
  const [topic, setTopic] = useState('All topics');
  const [drawer, setDrawer] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [removing, setRemoving] = useState<(typeof titles)[number] | null>(null);
  const [queue] = useState(() => createToastQueue(2));
  const visible = titles.filter((book) => topic === 'All topics' || book.topic === topic);
  const savedBooks = titles.filter((book) => saved.includes(book.id));

  return (
    <main className="publication-library" data-direction={direction} data-uld-theme={mode}>
      <style>{styles}</style>
      <div className="publication-wrap">
        <header className="publication-intro">
          <h1>{direction === 'enterprise' ? 'Publication library' : 'The reading room'}</h1>
          <nav aria-label="Library actions">
            <button
              type="button"
              ref={browseTrigger}
              className="uld-motion-action"
              onClick={() => setDrawer(true)}
            >
              Browse by topic
            </button>
            <button
              type="button"
              ref={listTrigger}
              className="uld-motion-action"
              onClick={() => setSheet(true)}
            >
              Reading list ({saved.length})
            </button>
          </nav>
        </header>
        <Carousel
          label="Publications"
          labels={labels}
          items={visible.map((book) => ({
            id: book.id,
            label: book.title,
            content: (
              <ExpandableMediaCard
                title={book.title}
                expandLabel="Read details"
                collapseLabel="Hide details"
                animate={direction === 'editorial'}
                media={
                  <div className="publication-cover" data-cover={book.id} aria-hidden="true">
                    <b>{book.title}</b>
                  </div>
                }
              >
                <p>
                  <strong>{book.author}</strong> · {book.topic}
                </p>
                <p>{book.detail}</p>
                <button
                  type="button"
                  className="uld-motion-action"
                  disabled={saved.includes(book.id)}
                  onClick={() => {
                    setSaved((previous) =>
                      previous.includes(book.id) ? previous : [...previous, book.id],
                    );
                    queue.add({
                      title: book.title + ' saved',
                      description: 'Added to your reading list.',
                    });
                  }}
                >
                  {saved.includes(book.id) ? 'Saved' : 'Save ' + book.title}
                </button>
              </ExpandableMediaCard>
            ),
          }))}
        />
      </div>
      {drawer && (
        <Drawer
          returnFocusRef={browseTrigger}
          placement="start"
          title="Browse by topic"
          closeLabel="Close topics"
          onDismiss={() => setDrawer(false)}
        >
          <menu>
            {['All topics', 'Architecture', 'Environment'].map((name) => (
              <li key={name}>
                <button
                  type="button"
                  className="uld-motion-action"
                  aria-pressed={name === topic}
                  onClick={() => {
                    setTopic(name);
                    setDrawer(false);
                  }}
                >
                  {name}
                </button>
              </li>
            ))}
          </menu>
        </Drawer>
      )}
      {sheet && (
        <GestureSheet
          returnFocusRef={listTrigger}
          title="Reading list"
          closeLabel="Close list"
          onDismiss={() => setSheet(false)}
        >
          {savedBooks.length === 0 ? (
            <p>No saved publications.</p>
          ) : (
            <ul>
              {savedBooks.map((book) => (
                <li className="publication-choice" key={book.id}>
                  <span>{book.title}</span>
                  <button
                    type="button"
                    className="uld-motion-action"
                    onClick={(event) => {
                      removeTrigger.current = event.currentTarget;
                      setRemoving(book);
                    }}
                  >
                    Remove {book.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {removing && (
            <AlertDialog
              returnFocusRef={removeTrigger}
              title={'Remove ' + removing.title + '?'}
              description="You can add this publication to your reading list again."
              confirmLabel="Remove title"
              cancelLabel="Keep title"
              onCancel={() => setRemoving(null)}
              onConfirm={() => {
                setSaved((previous) => previous.filter((id) => id !== removing.id));
                setRemoving(null);
              }}
            />
          )}
        </GestureSheet>
      )}
      <ToastRegion queue={queue} label="Reading list updates" dismissLabel="Dismiss" />
    </main>
  );
}

export const Enterprise: StoryObj<{ mode: GalleryMode }> = {
  render: (args) => <PublicationLibrary direction="enterprise" mode={args.mode} />,
};
export const Editorial: StoryObj<{ mode: GalleryMode }> = {
  render: (args) => <PublicationLibrary direction="editorial" mode={args.mode} />,
};
