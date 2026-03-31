import { Button, Chip, Stack, TextField, Typography } from '@mui/material';
import SurfaceCard from '../../common/SurfaceCard';
import StyledDateInput from '../../common/StyledDateInput';
import { formatHumanDate, formatHumanTime } from './reserve';

/**
 * Hosts the guest-facing reservation form and availability guidance copy.
 */
function GuestReservationCard({
  availableDateSet,
  bookableDinnerTimes,
  form,
  hasAvailability,
  isMobile,
  nextAvailableSlotLabel,
  onInputChange,
  onTimeSelect,
  onSubmit,
  selectedDinnerTime,
  selectedDinnerTimes,
}) {
  return (
    <SurfaceCard contentSx={{ p: { xs: 2.5, sm: 3 } }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
        Guest Reservation
      </Typography>
      <Stack component="form" onSubmit={onSubmit} spacing={2.5}>
        <StyledDateInput
          id="reservation-date"
          label="Date *"
          name="date"
          onChange={onInputChange}
          value={form.date}
          availableDateSet={availableDateSet}
        />

        <Stack spacing={1}>
          <Typography component="label" htmlFor="reservation-time" sx={{ fontWeight: 600 }}>
            Time *
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ minHeight: 40, alignItems: 'center' }}>
            {selectedDinnerTimes.length
              ? selectedDinnerTimes.map((time) => {
                  const isBookable = bookableDinnerTimes.includes(time);
                  const isSelected = selectedDinnerTime === time;

                  return (
                    <Chip
                      key={time}
                      component={isBookable ? 'button' : 'div'}
                      type={isBookable ? 'button' : undefined}
                      clickable={isBookable}
                      label={formatHumanTime(time)}
                      color={isBookable && isSelected ? 'secondary' : 'default'}
                      variant={isBookable && isSelected ? 'filled' : 'outlined'}
                      onClick={isBookable ? () => onTimeSelect(time) : undefined}
                      sx={{
                        height: 40,
                        fontSize: '0.95rem',
                        opacity: isBookable ? 1 : 0.72,
                        borderColor: isBookable ? 'rgba(217, 195, 161, 0.35)' : 'rgba(217, 195, 161, 0.2)',
                        color: isBookable && isSelected ? '#1a130d' : 'text.primary',
                        '& .MuiChip-label': {
                          px: 1.5,
                        },
                      }}
                    />
                  );
                })
              : null}
          </Stack>
          <Typography color="text.secondary">
            {bookableDinnerTimes.length
              ? selectedDinnerTime
                ? `Selected time: ${formatHumanTime(selectedDinnerTime)}`
                : 'Select one dinner seating shown for this night.'
              : nextAvailableSlotLabel
                ? `There are no availabilities for this day. Next available slot is ${nextAvailableSlotLabel}.`
                : 'There are no availabilities for this day.'}
          </Typography>
          <input id="reservation-time" type="hidden" name="time" value={form.time} readOnly />
        </Stack>
        <TextField
          id="reservation-name"
          label="Name"
          type="text"
          name="name"
          value={form.name}
          onChange={onInputChange}
          required
          fullWidth
        />
        <TextField
          id="reservation-email"
          label="Email"
          type="email"
          name="email"
          value={form.email}
          onChange={onInputChange}
          required
          fullWidth
        />
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={
            !hasAvailability ||
            !form.date ||
            !form.time ||
            !form.name.trim() ||
            !form.email.trim() ||
            !availableDateSet.has(form.date)
          }
          fullWidth={isMobile}
        >
          Confirm Reservation
        </Button>
      </Stack>
    </SurfaceCard>
  );
}

export default GuestReservationCard;
