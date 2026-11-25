export function Spinner({ label }: {
  /** Names the loading status. Omit it inside an action or region that already announces the operation. */
  label?: string;
}) {
  return <span role={label ? 'status' : undefined} aria-label={label} aria-hidden={label ? undefined : true} className="uld-spinner" />;
}
