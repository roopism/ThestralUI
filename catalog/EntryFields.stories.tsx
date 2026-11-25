import '@ui-lazy-dev/ui-web/controls.css';
import { useState, type FormEvent } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@ui-lazy-dev/ui-web';
import {
  CodeField,
  FileUpload,
  PasswordField,
  ValidationSummary,
  type FieldIssue,
} from '@ui-lazy-dev/ui-web/entry-fields';

const meta = { title: 'Molecules/Account recovery' } satisfies Meta;
export default meta;
export const Recovery: StoryObj = {
  render: function Recovery() {
    const [issues, setIssues] = useState<FieldIssue[]>([]);
    const [saved, setSaved] = useState(false);
    function submit(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const errors: FieldIssue[] = [];
      if (!/^\d{6}$/.test(String(data.get('code'))))
        errors.push({ fieldId: 'code', message: 'Enter the six-digit recovery code.' });
      if (String(data.get('password')).length < 12)
        errors.push({ fieldId: 'password', message: 'Use at least 12 characters.' });
      setIssues(errors);
      setSaved(!errors.length);
    }
    return (
      <main className="catalog uld-controls">
        <h1>Recover access</h1>
        <form className="specimen" noValidate onSubmit={submit}>
          <ValidationSummary label="Check your entries" errors={issues} />
          <CodeField
            label="Recovery code"
            id="code"
            name="code"
            digits={6}
            required
            error={issues.find((issue) => issue.fieldId === 'code')?.message}
          />
          <PasswordField
            label="New password"
            id="password"
            name="password"
            autoComplete="new-password"
            revealLabel="Show password"
            concealLabel="Hide password"
            error={issues.find((issue) => issue.fieldId === 'password')?.message}
            required
          />
          <FileUpload label="Supporting document" name="file" accept=".pdf" hint="Optional PDF" />
          <Button type="submit">Update access</Button>
          <p role="status">{saved && 'Access updated'}</p>
        </form>
      </main>
    );
  },
};
