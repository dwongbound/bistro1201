import { useState } from 'react';
import FormField from '../../common/FormField';
import Notice from '../../common/Notice';
import { ButtonSpinner } from '../../common/Spinner';
import { useFormErrors } from '../../common/useFormErrors';
import { submitWaitlistEntry } from './waitlistApi';

const EMPTY_FORM = { first_name: '', last_name: '', email: '', phone: '', notes: '' };

/**
 * Renders a public "Join the Waitlist" form shown above the access gate when the user
 * has not yet entered an access code.
 */
function WaitlistForm({ apiUrl }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const { errors, validate, clearError, clearAll } = useFormErrors();

  const handleChange = (event) => {
    const { name, value } = event.target;
    clearError(name);
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate({
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email,
      phone: form.phone,
    })) {
      setStatus({ type: 'error', message: 'Please fill in the required fields.' });
      return;
    }

    setBusy(true);
    setStatus({ type: '', message: '' });

    try {
      const response = await submitWaitlistEntry(apiUrl, {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        notes: form.notes.trim() || null,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Unable to join the waitlist right now.' }));
        setStatus({ type: 'error', message: payload.error || 'Unable to join the waitlist right now.' });
        return;
      }

      setForm(EMPTY_FORM);
      clearAll();
      setStatus({ type: 'success', message: "You're on the waitlist. We'll be in touch when a spot opens up." });
    } catch {
      setStatus({ type: 'error', message: 'Unable to join the waitlist right now.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="panel grid content-start gap-6">
      <div className="grid gap-2">
        <p className="eyebrow">No code yet?</p>
        <h2 className="font-display text-2xl tracking-tight sm:text-3xl">Join the Waitlist</h2>
        <p className="leading-relaxed text-muted">
          Add yourself to the waitlist and we&apos;ll send you an email when a spot opens up.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="First Name" name="first_name" autoComplete="given-name" value={form.first_name} onChange={handleChange} invalid={Boolean(errors.first_name)} />
        <FormField label="Last Name" name="last_name" autoComplete="family-name" value={form.last_name} onChange={handleChange} invalid={Boolean(errors.last_name)} />
        <FormField label="Email" name="email" type="email" autoComplete="email" value={form.email} onChange={handleChange} invalid={Boolean(errors.email)} />
        <FormField label="Phone Number" name="phone" type="tel" autoComplete="tel" value={form.phone} onChange={handleChange} invalid={Boolean(errors.phone)} />
      </div>
      <FormField label="Anything else we should know?" name="notes" multiline rows={3} value={form.notes} onChange={handleChange} />
      <button type="submit" disabled={busy} className="btn btn-ghost w-full sm:w-fit">
        {busy ? <ButtonSpinner /> : null}
        Join the Waitlist
      </button>
      {status.message ? (
        <Notice tone={status.type === 'error' ? 'error' : 'success'} role="alert">
          {status.message}
        </Notice>
      ) : null}
    </form>
  );
}

export default WaitlistForm;
