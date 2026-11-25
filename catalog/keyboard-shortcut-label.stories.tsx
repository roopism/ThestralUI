import type { Meta } from '@storybook/react-vite';
import '@ui-lazy-dev/tokens/modes.css';
import '@ui-lazy-dev/tokens/brands/enterprise.css';
import '@ui-lazy-dev/ui-web/keyboard-shortcut-label.css';
import './keyboard-shortcut-label/catalog.css';
import { Chord, Guide, InlineHelp, MenuCommand } from './keyboard-shortcut-label/Examples';

export default { title: 'Foundations/Keyboard Shortcut Label' } satisfies Meta;
export const EditorShortcuts = { render: Guide };
export const PlainChord = { render: Chord };
export const RtlInlineHelp = { render: InlineHelp };
export const FileMenu = { render: MenuCommand };
