import type { KeyboardEvent } from 'react';

const focusable = 'a[href],area[href],button,input,select,textarea,iframe,summary,audio[controls],video[controls],[tabindex],[contenteditable]';

/** Native modality makes the background inert. Cycle Tab before the browser transfers focus to its chrome. */
export function containTab(event: KeyboardEvent<HTMLDialogElement>) {
  const dialog = event.currentTarget;
  if (event.key !== 'Tab' || event.defaultPrevented || (event.target as Element).closest('dialog') !== dialog) return;
  const candidates = Array.from(dialog.querySelectorAll<HTMLElement>(focusable)).filter(node =>
    node.closest('dialog') === dialog && !node.closest('[inert],[hidden]') && !node.matches(':disabled') &&
    node.checkVisibility({ visibilityProperty: true }) && (node.tabIndex >= 0 ||
      (!node.hasAttribute('tabindex') && node.isContentEditable && !node.parentElement?.isContentEditable)),
  );
  // A radio group contributes one stop; positive tabindex precedes ordinary DOM order.
  const stops = candidates.filter(node => {
    if (!node.matches('input[type=radio][name]:not([name=""])')) return true;
    const input = node as HTMLInputElement;
    const group = candidates.filter((item): item is HTMLInputElement =>
      item.matches('input[type=radio]') && (item as HTMLInputElement).name === input.name && (item as HTMLInputElement).form === input.form);
    return (group.find(item => item.checked) ?? group[0]) === node;
  }).sort((a, b) => (a.tabIndex > 0 ? a.tabIndex : Infinity) - (b.tabIndex > 0 ? b.tabIndex : Infinity));
  const first = stops[0];
  const last = stops.at(-1);
  if (!first || event.target === dialog || (event.shiftKey ? event.target === first : event.target === last)) {
    event.preventDefault();
    (event.shiftKey ? last : first)?.focus();
  }
}
