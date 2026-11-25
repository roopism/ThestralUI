import { type ReactNode, useId } from "react";
export interface AppShellProps {
  header?: ReactNode;
  navigation: ReactNode;
  navigationLabel: string;
  skipLabel: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Supporting content in one complementary region beside the workspace, such as filters or details. Collapses when omitted. */
  aside?: ReactNode;
}
/** Supply the application's existing navigation as a slot. */
export function AppShell({
  header,
  navigation,
  navigationLabel,
  skipLabel,
  children,
  footer,
  aside,
}: AppShellProps) {
  const mainId = useId();
  return (
    <div className="uld-shell">
      <a className="uld-shell-skip" href={'#' + mainId}>
        {skipLabel}
      </a>
      {header && <header>{header}</header>}
      <div className="uld-shell-layout">
        <nav aria-label={navigationLabel}>{navigation}</nav>
        <main id={mainId} tabIndex={-1}>
          {children}
        </main>
        {aside && <aside>{aside}</aside>}
      </div>
      {footer && <footer>{footer}</footer>}
    </div>
  );
}
