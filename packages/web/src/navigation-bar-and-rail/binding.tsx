import { type ReactNode } from "react";
import { safeUrl } from "../_shared/safe-url/binding.js";
export interface NavigationEntry {
  id: string;
  href: string;
  label: string;
  icon?: ReactNode;
  /** Shows the destination as unavailable text instead of a link. */
  disabled?: boolean;
}
export interface AppNavigationProps {
  items: readonly NavigationEntry[];
  currentId?: string;
  renderLink?: (
    item: NavigationEntry,
    props: { 'aria-current'?: 'page'; children: ReactNode; href: string },
  ) => ReactNode;
}
/** Content for a labeled nav landmark. Links run horizontally in compact space and form a rail in a wide shell. */
export function AppNavigation({ items, currentId, renderLink }: AppNavigationProps) {
  return (
    <ul className="uld-app-links">
      {items.map((item) => {
        const href = item.disabled ? undefined : safeUrl(item.href, true);
        if (!href)
          return (
            <li key={item.id}>
              <span>{item.label}</span>
            </li>
          );
        const props = {
          href,
          'aria-current': item.id === currentId ? ('page' as const) : undefined,
          children: (
            <>
              {item.icon && <span aria-hidden="true">{item.icon}</span>}
              {item.label}
            </>
          ),
        };
        return <li key={item.id}>{renderLink ? renderLink(item, props) : <a {...props} />}</li>;
      })}
    </ul>
  );
}
