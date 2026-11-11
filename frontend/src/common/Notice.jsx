/**
 * Inline message box for empty, error, warning and success states on Tailwind pages.
 * `tone` is "info" (default), "error", "warning" or "success". `role` overrides the
 * default live-region role (alert for errors, status otherwise).
 */
function Notice({ tone = 'info', role, children }) {
  let toneClass = 'border-line-strong bg-ink-800/60 text-muted';
  if (tone === 'error') toneClass = 'border-red-400/40 bg-red-500/10 text-red-100';
  if (tone === 'warning') toneClass = 'border-amber-300/40 bg-amber-400/10 text-amber-50';
  if (tone === 'success') toneClass = 'border-emerald-300/30 bg-emerald-400/10 text-emerald-50';

  let liveRole = 'status';
  if (tone === 'error') liveRole = 'alert';
  if (role) liveRole = role;

  return (
    <div role={liveRole} className={`rounded-xl border px-5 py-4 text-sm leading-relaxed ${toneClass}`}>
      {children}
    </div>
  );
}

export default Notice;
