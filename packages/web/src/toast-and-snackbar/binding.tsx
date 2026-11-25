'use client';
import { UNSTABLE_ToastQueue as Queue, UNSTABLE_ToastRegion as Region, UNSTABLE_Toast as Toast, UNSTABLE_ToastContent as ToastContent, Text, Button } from "react-aria-components/Toast";
export interface ToastMessage {
  title: string;
  description?: string;
}
export function createToastQueue(maxVisible = 3) {
  return new Queue<ToastMessage>({ maxVisibleToasts: maxVisible });
}
export interface ToastRegionProps {
  queue: ReturnType<typeof createToastQueue>;
  label: string;
  dismissLabel: string;
}
export function ToastRegion({ queue, label, dismissLabel }: ToastRegionProps) {
  return (
    <Region queue={queue} aria-label={label} className="uld-toast-region">
      {({ toast }) => (
        <Toast toast={toast} className="uld-toast">
          <ToastContent>
            <Text slot="title" className="uld-toast-title">
              {toast.content.title}
            </Text>
            {toast.content.description && (
              <Text slot="description">{toast.content.description}</Text>
            )}
          </ToastContent>
          <Button slot="close" aria-label={dismissLabel} className="uld-motion-action">
            {dismissLabel}
          </Button>
        </Toast>
      )}
    </Region>
  );
}
