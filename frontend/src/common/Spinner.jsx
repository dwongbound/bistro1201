/**
 * Small spinning ring with a visible label, for anything waiting on the network.
 */
function Spinner({ label }) {
  return (
    <div role="status" className="flex items-center gap-3 text-sm text-muted">
      <span className="size-5 animate-spin rounded-full border-2 border-sand/25 border-t-sand" aria-hidden="true" />
      {label}
    </div>
  );
}

/**
 * Tiny spinner that sits inside a button while its request is running.
 */
export function ButtonSpinner() {
  return <span className="size-4 animate-spin rounded-full border-2 border-current/30 border-t-current" aria-hidden="true" />;
}

export default Spinner;
