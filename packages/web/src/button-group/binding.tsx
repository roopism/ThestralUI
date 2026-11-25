import { type BlockProps } from "../_shared/primitives/binding.js";
import { Inline } from "../inline/binding.js";
export function ButtonGroup({ label, ...props }: BlockProps & { label: string }) {
  return <Inline {...props} role="group" aria-label={label} />;
}
