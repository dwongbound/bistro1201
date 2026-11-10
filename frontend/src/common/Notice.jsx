/**
 * Inline message box for empty, error and warning states on Tailwind pages.
 * `tone` is "info" (default), "error" or "warning".
 */
function Notice({ tone = 'info', children }) {
  let toneClass = 'border-line-strong bg-ink-800/60 text-muted';
  if (tone === 'error') toneClass = 'border-red-400/40 bg-red-500/10 text-red-100';
  if (tone === 'warning') toneClass = 'border-amber-300/40 bg-amber-400/10 text-amber-50';

  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-xl border px-5 py-4 text-sm leading-relaxed ${toneClass}`}>
      {children}
    </div>
  );
}

export default Notice;
