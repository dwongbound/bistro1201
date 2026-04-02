import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import SurfaceCard from '../../common/SurfaceCard';
import StyledDateInput from '../../common/StyledDateInput';
import { CHIP_BORDER_RADIUS } from '../../common/theme';
import { formatHumanDate, formatHumanTime } from './reserve';

/**
 * Renders staff upgrade and availability-management controls beside the guest form.
 */
function StaffControlsCard({
  accessCodeBusy,
  accessCodes,
  authBusy,
  hasAvailabilityOnSelectedDate,
  isMobile,
  isStaff,
  onCreateAccessCode,
  onCloseDate,
  onDeleteAccessCode,
  onFreeSlot,
  onStaffAccessCodeChange,
  onUnlockStaff,
  onOpenDate,
  reservedDinnerTimes,
  selectedDate,
  selectedDinnerTime,
  selectedDinnerTimes,
  staffAccessCode,
  staffBusy,
  staffStatus,
}) {
  const [openDialog, setOpenDialog] = useState(false);
  const [openRemoveDialog, setOpenRemoveDialog] = useState(false);
  const [openFreeDialog, setOpenFreeDialog] = useState(false);
  const [dinnerTime, setDinnerTime] = useState(selectedDinnerTime || '19:00');
  const [timeToRemove, setTimeToRemove] = useState('');
  const [reservedTimeToFree, setReservedTimeToFree] = useState('');
  const [newGuestCode, setNewGuestCode] = useState('');
  const [newGuestCodeExpiresAt, setNewGuestCodeExpiresAt] = useState('');

  useEffect(() => {
    setDinnerTime(selectedDinnerTime || '19:00');
  }, [selectedDate, selectedDinnerTime]);

  useEffect(() => {
    setTimeToRemove('');
  }, [selectedDate]);

  useEffect(() => {
    setReservedTimeToFree('');
  }, [selectedDate]);

  /**
   * Confirms the dinner time before opening the selected date to guests.
   */
  const handleOpenDateSubmit = async () => {
    const wasSaved = await onOpenDate(dinnerTime);
    if (wasSaved) {
      setOpenDialog(false);
    }
  };

  const handleCreateAccessCode = async (event) => {
    event.preventDefault();
    const wasSaved = await onCreateAccessCode({
      code: newGuestCode.trim(),
      expiresAt: newGuestCodeExpiresAt,
    });
    if (wasSaved) {
      setNewGuestCode('');
      setNewGuestCodeExpiresAt('');
    }
  };

  const canSaveAccessCode = Boolean(newGuestCode.trim()) && !accessCodeBusy;

  const formatExpiration = (expiresAt) => {
    if (!expiresAt) {
      return 'No expiration';
    }
    const date = new Date(expiresAt * 1000);
    if (date < new Date()) {
      return 'Expired';
    }
    return date.toLocaleString();
  };

  const handleRemoveSlot = async () => {
    if (!timeToRemove) {
      return;
    }

    const wasRemoved = await onCloseDate(timeToRemove);
    if (wasRemoved) {
      setOpenRemoveDialog(false);
    }
  };

  const handleRemoveSlotClick = async () => {
    setTimeToRemove('');
    setOpenRemoveDialog(true);
  };

  const handleFreeSlotClick = async () => {
    setReservedTimeToFree('');
    setOpenFreeDialog(true);
  };

  const handleFreeSlotSubmit = async () => {
    if (!reservedTimeToFree) {
      return;
    }

    const wasFreed = await onFreeSlot(reservedTimeToFree);
    if (wasFreed) {
      setOpenFreeDialog(false);
    }
  };

  const selectedRemoveSlotIsReserved = reservedDinnerTimes.includes(timeToRemove);

  return (
    <SurfaceCard contentSx={{ p: { xs: 2.5, sm: 3 } }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          1201 Team Access
        </Typography>
      </Box>

      {staffStatus.message ? (
        <Alert severity={staffStatus.type === 'error' ? 'error' : 'success'} sx={{ mb: 2 }}>
          {staffStatus.message}
        </Alert>
      ) : null}

      {isStaff ? (
        <Stack spacing={2}>
          <Typography color="text.secondary">Selected date: {formatHumanDate(selectedDate)}</Typography>
          <Stack spacing={1}>
            <Typography color="text.secondary">
              {selectedDinnerTimes.length
                ? 'These are the dinner slots currently open for this date.'
                : 'No dinner slots are open for this date yet.'}
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {selectedDinnerTimes.map((time) => {
                return (
                  <Box
                    key={time}
                    component="span"
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      px: 1.75,
                      py: 1,
                      minHeight: 40,
                      border: '1px solid rgba(217, 195, 161, 0.22)',
                      borderRadius: `${CHIP_BORDER_RADIUS}px`,
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    }}
                  >
                    <Typography sx={{ fontSize: '0.95rem', fontWeight: 500 }}>
                      {formatHumanTime(time)}
                    </Typography>
                  </Box>
                );
              })}
            </Stack>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button variant="contained" onClick={() => setOpenDialog(true)} disabled={staffBusy} fullWidth={isMobile}>
              Add Slot
            </Button>
            <Button
              variant="contained"
              onClick={handleRemoveSlotClick}
              disabled={staffBusy || !hasAvailabilityOnSelectedDate}
              fullWidth={isMobile}
            >
              Remove Slot
            </Button>
            <Button
              variant="contained"
              onClick={handleFreeSlotClick}
              disabled={staffBusy || !reservedDinnerTimes.length}
              fullWidth={isMobile}
            >
              Free Slot
            </Button>
          </Stack>
          <Box sx={{ pt: 1, borderTop: '1px solid rgba(217, 195, 161, 0.12)' }}>
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Guest Access Codes
                </Typography>
                <Typography color="text.secondary">
                  Leave date and time empty to never expire.
                </Typography>
              </Box>
              <Stack
                component="form"
                onSubmit={handleCreateAccessCode}
                spacing={1.5}
              >
                <TextField
                  label="New Guest Code"
                  value={newGuestCode}
                  onChange={(event) => setNewGuestCode(event.target.value)}
                  fullWidth
                />
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.5}
                  alignItems={{ xs: 'stretch', sm: 'center' }}
                >
                  <StyledDateInput
                    id="guest-code-expires-at"
                    name="expires_at"
                    mode="datetime"
                    allowClear
                    fullWidth={false}
                    value={newGuestCodeExpiresAt}
                    onChange={(event) => setNewGuestCodeExpiresAt(event.target.value)}
                  />
                  <Box
                    sx={{
                      display: 'flex',
                      flex: { sm: 1 },
                      justifyContent: { xs: 'stretch', sm: 'flex-end' },
                      alignItems: { xs: 'stretch', sm: 'flex-start' },
                    }}
                  >
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={!canSaveAccessCode}
                      fullWidth={isMobile}
                      // This was done manually to align with the time select button.
                      sx={{ mt: { sm: 1 } }}
                    >
                      Create Code
                    </Button>
                  </Box>
                </Stack>
              </Stack>
              <Stack spacing={1.25}>
                {accessCodes.length ? (
                  <Box
                    sx={{
                      border: '1px solid rgba(217, 195, 161, 0.18)',
                      borderRadius: 1,
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        px: 1.75,
                        py: 1.25,
                        borderBottom: '1px solid rgba(217, 195, 161, 0.18)',
                        backgroundColor: 'rgba(217, 195, 161, 0.08)',
                      }}
                    >
                      <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.08em' }}>
                        Codes
                      </Typography>
                    </Box>
                    {accessCodes.map((accessCode, index) => {
                      const expirationLabel = formatExpiration(accessCode.expires_at);
                      const isExpired = expirationLabel === 'Expired';
                      return (
                        <Box
                          key={accessCode.code}
                          sx={{
                            px: 1.75,
                            py: 1.25,
                            borderBottom:
                              index === accessCodes.length - 1 ? 'none' : '1px solid rgba(217, 195, 161, 0.12)',
                            backgroundColor: index % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                          }}
                        >
                          <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{accessCode.code}</Typography>
                          <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Typography
                              color={isExpired ? 'error' : 'text.secondary'}
                              variant="body2"
                            >
                              {expirationLabel}
                            </Typography>
                            <Button
                              variant="text"
                              color="secondary"
                              onClick={() => onDeleteAccessCode(accessCode.code)}
                              disabled={accessCodeBusy}
                              sx={{ px: 0, minWidth: 0 }}
                            >
                              Remove Code
                            </Button>
                          </Stack>
                        </Box>
                      );
                    })}
                  </Box>
                ) : (
                  <Typography color="text.secondary">No guest access codes are stored yet.</Typography>
                )}
              </Stack>
            </Stack>
          </Box>
          <Divider sx={{ borderColor: 'rgba(217, 195, 161, 0.12)' }} />
          <Button
            component="a"
            href="/staff/gallery"
            variant="outlined"
            fullWidth={isMobile}
          >
            Gallery Admin
          </Button>
        </Stack>
      ) : (
        <Stack component="form" onSubmit={onUnlockStaff} spacing={2}>
          <TextField
            type="password"
            label="Staff Access Code"
            placeholder="Staff Access Code"
            value={staffAccessCode}
            onChange={onStaffAccessCodeChange}
            fullWidth
          />
          <Button type="submit" variant="outlined" disabled={authBusy} fullWidth={isMobile}>
            Unlock Staff Controls
          </Button>
        </Stack>
      )}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} fullWidth maxWidth="xs">
        <DialogTitle>Set Dinner Time</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography color="text.secondary">
              Choose the dinner time guests should see for {formatHumanDate(selectedDate)}.
            </Typography>
            <TextField
              type="time"
              label="Dinner Time"
              name="dinner_time"
              value={dinnerTime}
              onChange={(event) => setDinnerTime(event.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ step: 900 }}
              helperText="Pick the seating time guests should book for this date."
              fullWidth
              required
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleOpenDateSubmit} disabled={staffBusy}>
            Save and Open
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={openRemoveDialog} onClose={() => setOpenRemoveDialog(false)} fullWidth maxWidth="xs">
        <DialogTitle>Remove Dinner Slot</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography color="text.secondary">
              Choose which dinner slot to remove from {formatHumanDate(selectedDate)}.
            </Typography>
            <Stack spacing={1}>
              {selectedDinnerTimes.map((time) => (
                <Button
                  key={time}
                  variant={timeToRemove === time ? 'contained' : 'outlined'}
                  color={timeToRemove === time ? 'secondary' : 'inherit'}
                  onClick={() => setTimeToRemove(time)}
                  disabled={staffBusy}
                >
                  {formatHumanTime(time)}
                </Button>
              ))}
            </Stack>
            {selectedRemoveSlotIsReserved ? (
              <Alert severity="warning">
                Removing a reserved slot will also send a cancellation email.
              </Alert>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenRemoveDialog(false)}>Cancel</Button>
          <Button variant="contained" color="secondary" onClick={handleRemoveSlot} disabled={staffBusy || !timeToRemove}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={openFreeDialog} onClose={() => setOpenFreeDialog(false)} fullWidth maxWidth="xs">
        <DialogTitle>Free Reserved Slot</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography color="text.secondary">
              Choose which reserved slot to free from {formatHumanDate(selectedDate)}. This will send a cancellation email to the guest on that reservation.
            </Typography>
            <Stack spacing={1}>
              {reservedDinnerTimes.length ? (
                reservedDinnerTimes.map((time) => (
                  <Button
                    key={time}
                    variant={reservedTimeToFree === time ? 'contained' : 'outlined'}
                    color={reservedTimeToFree === time ? 'secondary' : 'inherit'}
                    onClick={() => setReservedTimeToFree(time)}
                    disabled={staffBusy}
                  >
                    {formatHumanTime(time)}
                  </Button>
                ))
              ) : (
                <Typography color="text.secondary">There are no reserved slots to free for this date.</Typography>
              )}
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenFreeDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleFreeSlotSubmit}
            disabled={staffBusy || !reservedTimeToFree}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </SurfaceCard>
  );
}

export default StaffControlsCard;
