import { type ButtonProps, Button } from "../button/binding.js";
import { type ReactElement } from "react";
export function IconButton(
  props: Omit<ButtonProps, 'startIcon' | 'endIcon'> & { icon: ReactElement },
) {
  return <Button {...props} />;
}
