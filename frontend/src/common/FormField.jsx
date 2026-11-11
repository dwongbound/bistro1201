/**
 * Labeled text input (or textarea with `multiline`) for Tailwind forms.
 * `invalid` outlines the field in red and sets aria-invalid; the field's own
 * label keeps it findable by screen readers and tests.
 */
function FormField({ id, label, multiline = false, rows = 3, invalid = false, className = '', ...inputProps }) {
  const fieldId = id || `field-${inputProps.name}`;
  let borderClass = 'border-line-strong hover:border-sand/50 focus:border-sand';
  if (invalid) {
    borderClass = 'border-red-400/80 focus:border-red-300';
  }
  const inputClass = `w-full rounded-xl border bg-ink-950/60 px-4 py-3 text-base text-cream placeholder:text-muted/50 outline-none transition-colors focus:ring-2 focus:ring-sand/20 ${borderClass}`;

  return (
    <div className={`grid gap-2 ${className}`}>
      <label htmlFor={fieldId} className="text-sm font-medium text-cream/90">
        {label}
      </label>
      {multiline ? (
        <textarea id={fieldId} rows={rows} aria-invalid={invalid} className={`${inputClass} resize-y`} {...inputProps} />
      ) : (
        <input id={fieldId} aria-invalid={invalid} className={`${inputClass} min-h-12`} {...inputProps} />
      )}
    </div>
  );
}

export default FormField;
