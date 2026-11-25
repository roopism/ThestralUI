import { type BlockProps, classes } from "../_shared/primitives/binding.js";
export type StatusProps = BlockProps & {
  /** Errors interrupt as an alert. Other tones wait for a pause in speech. */
  tone?: 'info' | 'success' | 'warning' | 'error';
};
export function Status({ tone = 'info', className, ...props }: StatusProps) {
  return (
    <div
      {...props}
      role={tone === 'error' ? 'alert' : 'status'}
      data-tone={tone}
      className={classes('uld-status', className)}
    />
  );
}
