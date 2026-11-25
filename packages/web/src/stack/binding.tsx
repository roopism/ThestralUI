import { type BlockProps, type LayoutSpace, layout } from "../_shared/primitives/binding.js";
export type StackProps = BlockProps & {
  /** Switch to wide spacing at 36rem in the nearest inline-size container. */
  gap?: LayoutSpace | { base: LayoutSpace; wide: LayoutSpace };
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline';
  justify?: 'start' | 'center' | 'end' | 'space-between' | 'space-around' | 'space-evenly';
};
export function Stack(props: StackProps) {
  return layout('uld-stack', props);
}
