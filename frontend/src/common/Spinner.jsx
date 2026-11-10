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

export default Spinner;
