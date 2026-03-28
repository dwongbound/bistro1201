import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';

/**
 * Confirms successful reservations without leaving the reserve dashboard.
 */
function ReservationConfirmationDialog({ confirmationDialog, onClose, onExited }) {
  return (
    <Dialog
      open={confirmationDialog.open}
      onClose={onClose}
      slotProps={{
        transition: {
          onExited,
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>{confirmationDialog.title || 'Reservation Confirmed'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} alignItems="center" sx={{ pt: 1, textAlign: 'center' }}>
          <Box
            sx={{
              width: 78,
              height: 78,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              background:
                'radial-gradient(circle at 30% 30%, rgba(244, 220, 178, 0.95), rgba(214, 166, 90, 0.98))',
              boxShadow: '0 16px 36px rgba(176, 122, 68, 0.28)',
              animation: 'confirmationPop 420ms cubic-bezier(0.22, 1, 0.36, 1)',
              '@keyframes confirmationPop': {
                '0%': {
                  opacity: 0,
                  transform: 'scale(0.55)',
                },
                '65%': {
                  opacity: 1,
                  transform: 'scale(1.08)',
                },
                '100%': {
                  opacity: 1,
                  transform: 'scale(1)',
                },
              },
            }}
          >
            <CheckRoundedIcon
              sx={{
                fontSize: 42,
                color: '#1a130d',
                animation: 'confirmationCheck 300ms ease-out 120ms both',
                '@keyframes confirmationCheck': {
                  '0%': {
                    opacity: 0,
                    transform: 'scale(0.7)',
                  },
                  '100%': {
                    opacity: 1,
                    transform: 'scale(1)',
                  },
                },
              }}
            />
          </Box>
          <Typography>{confirmationDialog.message}</Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ReservationConfirmationDialog;
