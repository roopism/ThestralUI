'use client';
import { type RefObject, useId } from "react";
import { Dialog } from "../modal-dialog/binding.js";
export interface AlertDialogProps {
  title: string;
  description: string;
  returnFocusRef?: RefObject<HTMLElement | null>;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}
/** Mount to open. The least destructive action receives initial focus. */
export function AlertDialog({
  title,
  description,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  returnFocusRef,
}: AlertDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  return (
    <Dialog
      role="alertdialog"
      returnFocusRef={returnFocusRef}
      labelledBy={titleId}
      describedBy={descriptionId}
      onDismiss={onCancel}
      className="uld-alert-modal"
    >
      <div className="uld-alert-content">
        <h2 id={titleId}>{title}</h2>
        <p id={descriptionId}>{description}</p>
        <div className="uld-motion-actions">
          <button type="button" onClick={onCancel} className="uld-motion-action">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="uld-motion-action"
            data-intent="danger"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
