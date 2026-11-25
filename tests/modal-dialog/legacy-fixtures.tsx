import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { DialogTrigger, Modal, ModalOverlay, OverlayDialog, Trigger } from '@ui-lazy-dev/ui-web/navigation';

// Stable consumer refs let the test count actual mounts and unmounts for each public Dialog.
function recordRef(name: string) {
  return (node: HTMLElement | null) => {
    if (!node) return;
    const counts = document.body.dataset;
    counts[name + 'Mounts'] = String(Number(counts[name + 'Mounts'] ?? 0) + 1);
    return () => { counts[name + 'Unmounts'] = String(Number(counts[name + 'Unmounts'] ?? 0) + 1); };
  };
}

const parentRef = recordRef('parent');
const childRef = recordRef('child');
const siblingRef = recordRef('sibling');

export function SequentialDialogs() {
  const [parentOpen, setParentOpen] = useState(false);
  const [siblingOpen, setSiblingOpen] = useState(false);
  const siblingLauncher = useRef<HTMLButtonElement>(null);
  const siblingFinish = useRef<HTMLButtonElement>(null);
  function dismissBoth() {
    // Some owners synchronously change routes or dismiss multiple dependent overlays on one action.
    flushSync(() => setParentOpen(false));
    siblingLauncher.current!.focus();
    flushSync(() => setSiblingOpen(true));
    siblingFinish.current!.focus();
    flushSync(() => setSiblingOpen(false));
  }
  return <>
    <DialogTrigger isOpen={parentOpen} onOpenChange={setParentOpen}>
      <Trigger>Open parent</Trigger>
      <ModalOverlay><Modal><OverlayDialog aria-label="Parent" ref={parentRef}>
        <DialogTrigger>
          <Trigger>Open child</Trigger>
          <ModalOverlay><Modal><OverlayDialog aria-label="Child" ref={childRef}>
            <Trigger slot="close">Finish child</Trigger>
          </OverlayDialog></Modal></ModalOverlay>
        </DialogTrigger>
        <Trigger onPress={dismissBoth}>Dismiss both</Trigger>
        <Trigger slot="close">Finish parent</Trigger>
      </OverlayDialog></Modal></ModalOverlay>
    </DialogTrigger>
    <DialogTrigger isOpen={siblingOpen} onOpenChange={setSiblingOpen}>
      <Trigger ref={siblingLauncher}>Open sibling</Trigger>
      <ModalOverlay><Modal><OverlayDialog aria-label="Sibling" ref={siblingRef}>
        <Trigger ref={siblingFinish} slot="close">Finish sibling</Trigger>
      </OverlayDialog></Modal></ModalOverlay>
    </DialogTrigger>
  </>;
}
