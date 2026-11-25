import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import {
  Breadcrumb,
  Breadcrumbs,
  DialogTrigger,
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  Heading,
  Keyboard,
  Link,
  Menu,
  MenuItem,
  MenuTrigger,
  Modal,
  ModalOverlay,
  OverlayDialog,
  Popover,
  Separator,
  SubmenuTrigger,
  Toolbar,
  Tooltip,
  TooltipTrigger,
  Trigger,
} from '@ui-lazy-dev/ui-web/navigation';
import {
  Label,
  ListBox,
  ListBoxItem,
  Select,
  SelectValue,
  Slider,
  SliderFill,
  SliderOutput,
  SliderThumb,
  SliderTrack,
  ToggleButton,
  ToggleButtonGroup,
} from '@ui-lazy-dev/ui-web/forms';
import '@ui-lazy-dev/ui-web/controls.css';

const meta = { title: 'Enterprise/Navigation' } satisfies Meta;
export default meta;
export const Actions: StoryObj<typeof meta> = {
  render: function Navigation() {
    const [message, setMessage] = useState('');
    return (
      <main className="catalog uld-controls">
        <Breadcrumbs aria-label="Location">
          <Breadcrumb>
            <Link href="#home">Workspace</Link>
          </Breadcrumb>
          <Breadcrumb>
            <Link href="#review">Review</Link>
          </Breadcrumb>
        </Breadcrumbs>
        <h1 id="review">Review settings</h1>
        <Toolbar aria-label="Review tools">
          <MenuTrigger>
            <Trigger>Actions</Trigger>
            <Popover className="uld-controls">
              <Menu aria-label="Review actions" onAction={(key) => setMessage(String(key))}>
                <MenuItem id="Archived">Archive</MenuItem>
                <Separator />
                <SubmenuTrigger>
                  <MenuItem>Export</MenuItem>
                  <Popover className="uld-controls">
                    <Menu
                      aria-label="Export format"
                      onAction={() => setMessage('Plain text exported')}
                    >
                      <MenuItem id="text">Plain text</MenuItem>
                    </Menu>
                  </Popover>
                </SubmenuTrigger>
              </Menu>
            </Popover>
          </MenuTrigger>
          <DialogTrigger>
            <Trigger>Review summary</Trigger>
            <ModalOverlay isDismissable>
              <Modal>
                <OverlayDialog aria-label="Review summary">
                  <Heading slot="title">Review summary</Heading>
                  <p>Changes take effect after approval.</p>
                  <Trigger slot="close">Close</Trigger>
                </OverlayDialog>
              </Modal>
            </ModalOverlay>
          </DialogTrigger>
        </Toolbar>
        <TooltipTrigger delay={0} closeDelay={0}>
          <Trigger>Policy help</Trigger>
          <Tooltip>Contact the review owner for exceptions.</Tooltip>
        </TooltipTrigger>
        <p role="status" aria-label="Action result">
          {message}
        </p>
        <DisclosureGroup>
          <Disclosure>
            <Heading>
              <Trigger slot="trigger">Review policy</Trigger>
            </Heading>
            <DisclosurePanel>Review retention is 30 days.</DisclosurePanel>
          </Disclosure>
        </DisclosureGroup>
        <Select defaultSelectedKey="en">
          <Label>Language</Label>
          <Trigger>
            <SelectValue />
          </Trigger>
          <Popover className="uld-controls">
            <ListBox>
              <ListBoxItem id="en">English</ListBoxItem>
              <ListBoxItem id="fr">French</ListBoxItem>
            </ListBox>
          </Popover>
        </Select>
        <Slider minValue={1} maxValue={5} defaultValue={2}>
          <Label>Priority</Label>
          <SliderOutput />
          <SliderTrack style={{ position: 'relative', height: 'var(--uld-space-lg)' }}>
            <SliderFill />
            <SliderThumb />
          </SliderTrack>
        </Slider>
        <ToggleButtonGroup
          aria-label="Review density"
          selectionMode="single"
          defaultSelectedKeys={['auto']}
        >
          <ToggleButton id="auto">Automatic</ToggleButton>
          <ToggleButton id="compact">Compact</ToggleButton>
        </ToggleButtonGroup>
        <p>
          Use <Keyboard>Tab</Keyboard> to move between groups.
        </p>
      </main>
    );
  },
};
