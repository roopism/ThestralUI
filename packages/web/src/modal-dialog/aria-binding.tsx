'use client';
import { forwardRef, useCallback, type Ref } from 'react';
import { Dialog as AriaDialog, PopoverContext, useSlottedContext, type DialogProps } from 'react-aria-components';
export { DialogTrigger, Modal, ModalOverlay } from 'react-aria-components';

const restoreEvent = 'react-aria-focus-scope-restore';
const activeGuard = new WeakMap<Document, (event: Event) => void>();

type ForwardDialog = (
  render: (props: DialogProps, ref: Ref<HTMLElement>) => ReturnType<typeof AriaDialog>,
) => typeof AriaDialog;

// React Aria types its forwardRef render as ReactElement | null. This narrower
// factory still checks both the returned element and the HTMLElement ref.
const forwardDialog = forwardRef as ForwardDialog;

export const OverlayDialog: typeof AriaDialog = /*#__PURE__*/ forwardDialog(function Dialog(props, ref) {
  const trigger = useSlottedContext(PopoverContext);
  const triggerRef = trigger?.trigger === 'DialogTrigger' ? trigger.triggerRef : undefined;
  const attach = useCallback((panel: HTMLElement | null) => {
    if (!panel) return;
    const launcher = triggerRef?.current;
    const owner = panel.ownerDocument;
    const dispose = typeof ref === 'function' ? ref(panel) : undefined;
    if (ref && typeof ref !== 'function') ref.current = panel;
    return () => {
      // React Aria restores on the next frame. Let the most recently dismissed active dialog
      // keep its turn if an older overlay scheduled restoration in that same frame.
      const view = owner.defaultView;
      if (view && launcher instanceof view.HTMLElement && panel.contains(owner.activeElement)) {
        queueMicrotask(() => {
          if (panel.isConnected || !launcher.isConnected || owner.activeElement !== owner.body ||
              launcher.matches(':disabled,[aria-disabled="true"]') || launcher.closest('[inert],[hidden]')) return;
          const guard = (event: Event) => {
            if (owner.activeElement === owner.body && event.target !== launcher) event.preventDefault();
          };
          const previous = activeGuard.get(owner);
          if (previous) owner.removeEventListener(restoreEvent, previous, true);
          activeGuard.set(owner, guard);
          owner.addEventListener(restoreEvent, guard, true);
          view.requestAnimationFrame(() => {
            if (activeGuard.get(owner) !== guard) return;
            owner.removeEventListener(restoreEvent, guard, true);
            activeGuard.delete(owner);
          });
        });
      }
      if (typeof dispose === 'function') dispose();
      else if (typeof ref === 'function') ref(null);
      else if (ref) ref.current = null;
    };
  }, [ref, triggerRef]);
  return <AriaDialog {...props} ref={attach} />;
});
