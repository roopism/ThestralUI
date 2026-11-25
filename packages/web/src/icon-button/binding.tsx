import { type ButtonProps, Button } from "../button/binding.js";
export function IconButton({ label, children, ...props }: ButtonProps & { label: string; tone?: 'primary' | 'secondary' }) {
  return (
    <Button {...props} data-icon-only="" aria-label={label}>
      <span aria-hidden="true" inert>{children}</span>
    </Button>
  );
}
