import { useCallback, useState } from 'react';

/**
 * Tracks per-field validation errors so forms can show MUI-styled inline
 * messages instead of the browser's native required-field tooltip.
 *
 * Usage:
 *   const { errors, validate, clearError, clearAll } = useFormErrors();
 *
 *   // In your submit handler — add noValidate to the <form> element:
 *   if (!validate({ title: form.title, slug: form.slug })) return;
 *
 *   // On each TextField:
 *   error={Boolean(errors.title)}
 *   helperText={errors.title}
 *   onChange={(e) => { clearError('title'); … }}
 */
export function useFormErrors() {
  const [errors, setErrors] = useState({});

  /**
   * Validates a plain object of { fieldName: value } pairs.
   * Marks any field whose trimmed value is empty as required.
   * Returns true when all fields pass.
   */
  const validate = useCallback((fields) => {
    const next = {};
    for (const [name, value] of Object.entries(fields)) {
      if (!value || (typeof value === 'string' && !value.trim())) {
        next[name] = 'Required.';
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }, []);

  /** Clears the error for a single field (call from onChange). */
  const clearError = useCallback((name) => {
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  /** Clears all errors (e.g. on form reset). */
  const clearAll = useCallback(() => setErrors({}), []);

  return { errors, validate, clearError, clearAll };
}
