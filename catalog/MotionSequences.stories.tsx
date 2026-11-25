import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  animateSharedElement,
  captureSharedElement,
  playMotionSequence,
  type MotionHandle,
  type SharedElementBounds,
} from '@ui-lazy-dev/ui-web/motion';
import '@ui-lazy-dev/ui-web/motion.css';

const meta = { title: 'Motion/ProofReview', parameters: { layout: 'fullscreen' } } satisfies Meta;
export default meta;

function ProofReview() {
  const [approved, setApproved] = useState(false);
  const [result, setResult] = useState('Ready');
  const visual = useRef<HTMLDivElement>(null);
  const stages = useRef<HTMLOListElement>(null);
  const source = useRef<SharedElementBounds | null>(null);
  const layout = useRef<MotionHandle | null>(null);
  const sequence = useRef<MotionHandle | null>(null);

  useLayoutEffect(() => {
    if (source.current && visual.current)
      layout.current = animateSharedElement(source.current, visual.current);
    source.current = null;
    return () => layout.current?.cancel();
  }, [approved]);

  useEffect(
    () => () => {
      const playing = sequence.current;
      sequence.current = null;
      playing?.cancel();
    },
    [],
  );

  function move() {
    source.current = captureSharedElement(visual.current!);
    setApproved((value) => !value);
  }

  function play() {
    const elements = Array.from(stages.current!.children) as HTMLElement[];
    const handle = playMotionSequence(
      elements.map((element) => ({ element, preset: 'spring' })),
      { stagger: 100 },
    );
    sequence.current = handle;
    setResult('Playing');
    void handle.finished.then((value) => {
      if (sequence.current === handle) setResult(value);
    });
  }

  const proof = (
    <div ref={visual} className="proof-ticket">
      Cover proof
    </div>
  );
  return (
    <main className="catalog proof-demo">
      <style>{`
      .proof-demo { max-width: 60rem; margin-inline: auto; }
      .proof-columns { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr)); gap: 1rem; margin-block: 1rem; }
      .proof-columns section { min-height: 6rem; border: 1px solid var(--uld-border); padding: 1rem; }
      .proof-columns h2 { margin: 0 0 1rem; font-size: 1.25rem; }
      .proof-ticket { width: fit-content; border-radius: var(--uld-radius); background: var(--uld-accent); color: var(--uld-on-accent); padding: .65rem .85rem; }
      .proof-stages { padding-inline-start: 1.5rem; line-height: 1.8; }
    `}</style>
      <h1>Proof review</h1>
      <div className="proof-columns">
        <section aria-label="In review">
          <h2>In review</h2>
          {!approved && proof}
        </section>
        <section aria-label="Approved">
          <h2>Approved</h2>
          {approved && proof}
        </section>
      </div>
      <button type="button" className="uld-motion-action" onClick={move}>
        Move proof
      </button>
      <h2>Production steps</h2>
      <ol ref={stages} className="proof-stages">
        <li>Colour balance</li>
        <li>Typesetting</li>
        <li>Final inspection</li>
      </ol>
      <div className="uld-motion-actions">
        <button type="button" className="uld-motion-action" onClick={play}>
          Play sequence
        </button>
        <button
          type="button"
          className="uld-motion-action"
          onClick={() => sequence.current?.reverse()}
        >
          Reverse
        </button>
        <button
          type="button"
          className="uld-motion-action"
          onClick={() => sequence.current?.cancel()}
        >
          Cancel sequence
        </button>
      </div>
      <p role="status">{result}</p>
    </main>
  );
}

export const Interactive: StoryObj<typeof meta> = { render: () => <ProofReview /> };
