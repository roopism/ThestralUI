'use client';
import { useEffect, useState, useId, useMemo } from "react";
import { canonicalLocale } from '../_shared/messages/locale.js';
import { commandLabels } from './messages.js';
import { Dialog } from "../modal-dialog/binding.js";
export interface CommandEntry {
  id: string;
  label: string;
  keywords?: readonly string[];
  disabled?: boolean;
}
export interface CommandPaletteProps {
  label: string;
  commands: readonly CommandEntry[];
  onDismiss: () => void;
  onChoose: (id: string) => void;
  locale?: string;
  /** Explicit invoker for platforms that leave pointer-activated buttons unfocused. */
  returnFocusTo?: HTMLElement | null;
  labels?: { search?: string; close?: string; empty?: string };
}
/** Mount while open. The owner handles command execution and decides whether to dismiss. */
export function CommandPalette({
  label,
  commands,
  onChoose,
  onDismiss,
  locale: localeTag,
  returnFocusTo,
  labels: overrides,
}: CommandPaletteProps) {
  const locale = canonicalLocale(localeTag);
  const messages = commandLabels(locale);
  const labels = {
    search: overrides?.search ?? messages?.search,
    empty: overrides?.empty ?? messages?.empty,
    close: overrides?.close ?? messages?.close,
  };
  useEffect(
    () => () => {
      if (returnFocusTo)
        queueMicrotask(() => {
          if (returnFocusTo.isConnected) returnFocusTo.focus({ preventScroll: true });
        });
    },
    [returnFocusTo],
  );
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const uid = useId(),
    listId = useId();
  const matches = useMemo(() => {
    const needle = query.trim().normalize('NFC').toLocaleLowerCase(locale);
    return commands.filter((command) =>
      [command.label, ...(command.keywords ?? [])].some((token) =>
        token.normalize('NFC').toLocaleLowerCase(locale).includes(needle),
      ),
    );
  }, [query, commands, locale]);
  const enabled = matches.filter((command) => !command.disabled);
  const active = enabled.find((command) => command.id === activeId) ?? enabled[0];
  const optionId = (id: string) => listId + '-' + encodeURIComponent(id);
  const activeElementId = active ? optionId(active.id) : undefined;
  useEffect(() => {
    if (activeElementId)
      document.getElementById(activeElementId)?.scrollIntoView?.({ block: 'nearest' });
  }, [activeElementId]);
  return (
    <Dialog className="uld-commands" labelledBy={uid} onDismiss={onDismiss}>
      <h2 id={uid}>{label}</h2>
      <input
        autoFocus
        role="combobox"
        aria-label={labels?.search ?? 'Search commands'}
        aria-autocomplete="list"
        aria-expanded="true"
        aria-controls={listId}
        aria-activedescendant={activeElementId}
        value={query}
        onChange={(event) => {
          setActiveId(null);
          setQuery(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
          if (event.key === 'Enter') {
            event.preventDefault();
            if (active) onChoose(active.id);
            return;
          }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!enabled.length) return;
            const index = enabled.findIndex((candidate) => candidate.id === active?.id);
            const delta = event.key === 'ArrowDown' ? 1 : -1;
            setActiveId(enabled[(index + delta + enabled.length) % enabled.length].id);
          }
        }}
      />
      <ul id={listId} role="listbox" aria-label={label}>
        {matches.map((command) => (
          <li
            role="option"
            key={command.id}
            id={optionId(command.id)}
            aria-selected={active?.id === command.id}
            aria-disabled={command.disabled || undefined}
            onPointerDown={(event) => {
              if (event.pointerType === 'mouse') event.preventDefault();
            }}
            onClick={() => {
              if (!command.disabled) onChoose(command.id);
            }}
          >
            {command.label}
          </li>
        ))}
      </ul>
      {!matches.length && <p role="status">{labels?.empty ?? 'No matching commands'}</p>}
      <button type="button" onClick={onDismiss}>
        {labels?.close ?? 'Close'}
      </button>
    </Dialog>
  );
}
