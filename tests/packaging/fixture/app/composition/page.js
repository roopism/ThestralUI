import '@ui-lazy-dev/ui-web/controls.css';
import {
  DialogTrigger, Heading, Keyboard, Menu, MenuItem, MenuTrigger, Modal, ModalOverlay,
  OverlayDialog, Popover, Separator, Trigger,
} from '@ui-lazy-dev/ui-web/navigation';

export default function CompositionPage() {
  return <main>
    <h1>Reading preferences</h1>
    <DialogTrigger>
      <Trigger>Choose edition</Trigger>
      <ModalOverlay><Modal><OverlayDialog>
        <Heading slot="title">Edition preferences</Heading>
        <Trigger slot="close">Close</Trigger>
      </OverlayDialog></Modal></ModalOverlay>
    </DialogTrigger>
    <MenuTrigger>
      <Trigger>Reading actions</Trigger>
      <Popover className="uld-controls"><Menu aria-label="Reading actions">
        <MenuItem id="save" textValue="Save chapter">Save chapter <Keyboard>⌘S</Keyboard></MenuItem>
        <Separator />
        <MenuItem id="print">Print chapter</MenuItem>
      </Menu></Popover>
    </MenuTrigger>
  </main>;
}
