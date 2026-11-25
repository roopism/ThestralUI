'use client';
import { type ReactNode, useId } from "react";
import { type WorkflowAvailability, AvailabilityMessage } from "../_shared/workflows-status/binding.js";
export interface PreferenceSetting {
  id: string;
  label: string;
  description?: ReactNode;
  enabled: boolean;
  disabled?: boolean;
}
export interface SettingsGroup {
  id: string;
  label: string;
  /** Explains the whole group; announced when focus enters it. */
  description?: ReactNode;
  settings: readonly PreferenceSetting[];
}
export interface SettingsPanelProps {
  label: string;
  groups: readonly SettingsGroup[];
  onChange: (id: string, enabled: boolean) => void;
  availability?: WorkflowAvailability;
  empty?: ReactNode;
}
export function SettingRow({
  setting,
  onChange,
}: {
  setting: PreferenceSetting;
  onChange: SettingsPanelProps['onChange'];
}) {
  const input = useId(),
    help = useId();
  return (
    <div className="uld-setting">
      <label htmlFor={input}>{setting.label}</label>
      <input
        id={input}
        role="switch"
        type="checkbox"
        checked={setting.enabled}
        disabled={setting.disabled}
        aria-describedby={setting.description ? help : undefined}
        onChange={(event) => onChange(setting.id, event.target.checked)}
      />
      {setting.description && <div id={help}>{setting.description}</div>}
    </div>
  );
}
function SettingsFieldset({ group, onChange }: { group: SettingsGroup; onChange: SettingsPanelProps['onChange'] }) {
  const help = useId();
  return (
    <fieldset aria-describedby={group.description ? help : undefined}>
      <legend>{group.label}</legend>
      {group.description && <p id={help}>{group.description}</p>}
      {group.settings.map((setting) => (
        <SettingRow key={setting.id} setting={setting} onChange={onChange} />
      ))}
    </fieldset>
  );
}
export function SettingsPanel({
  label,
  groups,
  onChange,
  availability,
  empty = 'No settings available',
}: SettingsPanelProps) {
  return (
    <section aria-label={label} className="uld-workflow-card">
      <h2>{label}</h2>
      {availability ? (
        <AvailabilityMessage state={availability} />
      ) : groups.some((group) => group.settings.length) ? (
        groups
          .filter((group) => group.settings.length)
          .map((group) => <SettingsFieldset key={group.id} group={group} onChange={onChange} />)
      ) : (
        <p role="status">{empty}</p>
      )}
    </section>
  );
}
