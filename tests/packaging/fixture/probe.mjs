'use client';
import { createElement as item, useEffect, useState } from 'react';
import { Button, FormField } from '@ui-lazy-dev/ui-web';
import { Dialog } from '@ui-lazy-dev/ui-web/dialog';

export default function Probe() {
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => setReady(true), []);
  return item('main', { 'data-ready': ready },
    item(FormField, { label: 'Project', hint: 'Enter a working title' }, item('input')),
    item(Button, { onClick: () => setOpen(true) }, 'Review'),
    open && item(Dialog, { labelledBy: 'review-title', onDismiss: () => setOpen(false) },
      item('h2', { id: 'review-title' }, 'Review project'),
      item(Button, { onClick: () => setOpen(false) }, 'Dismiss')));
}
