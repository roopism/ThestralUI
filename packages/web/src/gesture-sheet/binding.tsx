'use client';
import { type RefObject, type ReactNode } from "react";
import { EdgePanel } from "../_shared/motion-overlays/binding.js";
export interface GestureSheetProps {
  title: string;
  returnFocusRef?: RefObject<HTMLElement | null>;
  closeLabel: string;
  children: ReactNode;
  onDismiss: () => void;
}
/** Mount to open. Only the grip captures a drag, leaving the panel body scrollable. */
export function GestureSheet(props: GestureSheetProps) {
  return <EdgePanel {...props} placement="bottom" />;
}
