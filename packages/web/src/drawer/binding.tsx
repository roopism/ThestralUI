'use client';
import { type GestureSheetProps } from "../gesture-sheet/binding.js";
import { EdgePanel } from "../_shared/motion-overlays/binding.js";
export interface DrawerProps extends GestureSheetProps {
  placement?: 'start' | 'end';
}
export function Drawer({ placement = 'end', ...props }: DrawerProps) {
  return <EdgePanel {...props} placement={placement} />;
}
