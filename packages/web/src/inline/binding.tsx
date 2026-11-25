import { type StackProps } from "../stack/binding.js";
import { layout } from "../_shared/primitives/binding.js";
export type InlineProps = StackProps & { wrap?: boolean };
export function Inline(props: InlineProps) {
  return layout('uld-inline', props);
}
