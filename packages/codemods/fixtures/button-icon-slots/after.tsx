import { Button as Action } from '@ui-lazy-dev/ui-web';
import * as UI from '@ui-lazy-dev/ui-web';
import { Button as Other } from 'other-library';

export const controls = <>
  <Action busy startIcon={<SaveIcon />}>Save</Action>
  <UI.Button tone="secondary" endIcon={<Arrow />}>Forward</UI.Button>
  <Action startIcon={<Left />} endIcon={<Right />}>Move</Action>
  <Action><span className="leading" inert aria-hidden><Icon /></span>Retain styling</Action>
  <Action><span aria-hidden><Icon /></span>Retain interactivity</Action>
  <Action {...props}><span inert aria-hidden><Icon /></span>Retain spread</Action>
  <Action><span inert aria-hidden><Icon /></span>{dynamicLabel}</Action>
  <Other><span inert aria-hidden><Icon /></span>Other library</Other>
</>;

export function local(Action: typeof Other, UI: { Button: typeof Other }) {
  return <>
    <Action><span inert aria-hidden><Icon /></span>Local action</Action>
    <UI.Button><span inert aria-hidden><Icon /></span>Local namespace</UI.Button>
  </>;
}
