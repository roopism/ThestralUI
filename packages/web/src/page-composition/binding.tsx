import { type ReactNode, useId } from "react";
export interface WorkspacePageProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}
export function WorkspacePage({ title, description, actions, children }: WorkspacePageProps) {
  const headingId = useId();
  return (
    <section className="uld-workspace-page" aria-labelledby={headingId}>
      <header>
        <div>
          <h1 id={headingId}>{title}</h1>
          {description}
        </div>
        {actions && <div className="uld-page-actions">{actions}</div>}
      </header>
      {children}
    </section>
  );
}
