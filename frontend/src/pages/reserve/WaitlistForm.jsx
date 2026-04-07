import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import SurfaceCard from '../../common/SurfaceCard';
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
    <SurfaceCard contentSx={{ p: { xs: 3, sm: 4 } }}>
      <Stack component="form" onSubmit={handleSubmit} spacing={3} noValidate>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
            Join the Waitlist
          </Typography>
          <Typography sx={{ color: 'text.secondary', lineHeight: 1.8 }}>
            Add yourself to the waitlist and we'll send you an
            email when a spot opens up!
          </Typography>
          <Typography sx={{ color: 'text.secondary', lineHeight: 1.8, fontStyle: 'italic' }}>
            Have a code? Enter it in the section below.
          </Typography>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <TextField
            label="First Name"
            name="first_name"
            value={form.first_name}
            onChange={handleChange}
            error={Boolean(errors.first_name)}
            helperText={errors.first_name}
            fullWidth
          />
          <TextField
            label="Last Name"
            name="last_name"
            value={form.last_name}
            onChange={handleChange}
            error={Boolean(errors.last_name)}
            helperText={errors.last_name}
            fullWidth
          />
          <TextField
            label="Email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            error={Boolean(errors.email)}
            helperText={errors.email}
            fullWidth
          />
          <TextField
            label="Phone Number"
            name="phone"
            type="tel"
            value={form.phone}
            onChange={handleChange}
            error={Boolean(errors.phone)}
            helperText={errors.phone}
            fullWidth
          />
        </Box>
        <TextField
          label="Anything else we should know?"
          name="notes"
          value={form.notes}
          onChange={handleChange}
          multiline
          rows={3}
          fullWidth
        />
        <Box>
          <Button type="submit" variant="contained" size="large" disabled={busy}>
            Join the Waitlist
          </Button>
        </Box>
        {status.message ? (
          <Alert severity={status.type === 'error' ? 'error' : 'success'}>
            {status.message}
          </Alert>
        ) : null}
      </Stack>
    </SurfaceCard>
  );
}

export default WaitlistForm;
