'use client';
import { type ReactNode } from "react";
import { type WorkflowAvailability, AvailabilityMessage, useActionFocus } from "../_shared/workflows-status/binding.js";
export interface NotificationItem {
  id: string;
  title: string;
  detail?: ReactNode;
  read: boolean;
}
export interface NotificationCenterProps {
  label: string;
  items: readonly NotificationItem[];
  availability?: WorkflowAvailability;
  onRead: (id: string) => void;
  onReadAll?: (ids: string[]) => void;
  labels?: {
    empty?: string;
    readAll?: string;
    markRead?: (title: string) => string;
    unread?: string;
    read?: string;
  };
}
export function NotificationCenter({
  label,
  items,
  availability,
  onRead,
  onReadAll,
  labels,
}: NotificationCenterProps) {
  const { heading, remember } = useActionFocus();
  const unread = items.filter((item) => !item.read).map((item) => item.id);
  return (
    <section onClickCapture={remember} className="uld-workflow-card" aria-label={label}>
      <h2 ref={heading} tabIndex={-1}>{label}</h2>
      {availability ? (
        <AvailabilityMessage state={availability} />
      ) : !items.length ? (
        <p role="status">{labels?.empty ?? 'No notifications'}</p>
      ) : (
        <>
          {onReadAll && (
            <button type="button" disabled={!unread.length} onClick={() => onReadAll(unread)}>
              {labels?.readAll ?? 'Mark all as read'}
            </button>
          )}
          <ul>
            {items.map((item) => (
              <li key={item.id} data-has-action={!item.read || undefined}>
                <div>
                  <strong>{item.title}</strong>
                  <span className="uld-workflow-meta">
                    {item.read ? (labels?.read ?? 'Read') : (labels?.unread ?? 'Unread')}
                  </span>
                </div>
                {item.detail}
                {!item.read && (
                  <button type="button" onClick={() => onRead(item.id)}>
                    {labels?.markRead?.(item.title) ?? 'Mark ' + item.title + ' as read'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
