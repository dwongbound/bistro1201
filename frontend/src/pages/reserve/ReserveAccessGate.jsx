import { Alert, Button, Grid, Stack, TextField, Typography } from '@mui/material';
import { useFormErrors } from '../../common/useFormErrors';
import SurfaceCard from '../../common/SurfaceCard';

/**
 * Renders the initial access-code gate shown before a reserve session is created.
 */
function ReserveAccessGate({ accessCode, authBusy, authStatus, onAccessCodeChange, onSubmit }) {
  const { errors, validate, clearError } = useFormErrors();

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!validate({ access_code: accessCode })) {
      return;
    }
    onSubmit(event);
  };

  return (
    <Grid container spacing={4} alignItems="stretch">
      <Grid size={{ xs: 12, md: 6 }}>
        <SurfaceCard
          cardSx={{
            minHeight: '100%',
            background: 'linear-gradient(145deg, rgba(36,59,47,0.95), rgba(80,107,90,0.85))',
            color: 'common.white',
          }}
          contentSx={{ p: { xs: 3, sm: 4 } }}
        >
          <Stack spacing={2}>
            <Typography variant="h3" sx={{ fontWeight: 800 }}>
              Enter an Access Code
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.78)', lineHeight: 1.8 }}>
              The reserve calendar validates every API request on the backend. Guest codes can view
              open nights and reserve, and staff codes can also manage availability.
            </Typography>
          </Stack>
        </SurfaceCard>
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <SurfaceCard cardSx={{ minHeight: '100%' }} contentSx={{ p: { xs: 3, sm: 4 } }}>
          <Stack component="form" onSubmit={handleSubmit} spacing={3} noValidate>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Reserve Access
            </Typography>
            <TextField
              type="password"
              label="Access Code"
              value={accessCode}
              onChange={(event) => {
                clearError('access_code');
                onAccessCodeChange(event);
              }}
              placeholder="Access Code"
              error={Boolean(errors.access_code)}
              helperText={errors.access_code}
              fullWidth
            />
            <Button type="submit" variant="contained" size="large" disabled={authBusy}>
              Submit
            </Button>
            {authStatus.message ? (
              <Alert severity={authStatus.type === 'error' ? 'error' : 'success'}>
                {authStatus.message}
              </Alert>
            ) : null}
          </Stack>
        </SurfaceCard>
      </Grid>
    </Grid>
  );
}

export default ReserveAccessGate;
