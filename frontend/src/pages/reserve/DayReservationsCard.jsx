import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import { Box, Button, CircularProgress, Divider, Stack, Typography } from '@mui/material';
import SurfaceCard from '../../common/SurfaceCard';
import { formatHumanDate } from './reserve';

/**
 * Summarizes the selected night and nearby open dates without distracting from the booking flow.
 */
function DayReservationsCard({
  availableDinnerTime,
  isDateOpen,
  loadingDashboard,
  selectedDate,
  suggestedDates,
  onSelectSuggestedDate,
}) {
  return (
    <SurfaceCard contentSx={{ p: { xs: 2.5, sm: 3 } }}>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
        <CalendarMonthRoundedIcon color="secondary" />
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Selected Night
          </Typography>
          <Typography color="text.secondary">
            {formatHumanDate(selectedDate)}
          </Typography>
        </Box>
      </Stack>
      <Divider sx={{ mb: 2 }} />
      {loadingDashboard ? (
        <Stack direction="row" spacing={1.5} alignItems="center">
          <CircularProgress size={20} />
          <Typography color="text.secondary">Loading selected night...</Typography>
        </Stack>
      ) : (
        <Stack spacing={2}>
          {suggestedDates.length > 0 ? (
            <>
              <Typography color="text.secondary">You can also jump to another open night below.</Typography>
              {availableDinnerTime ? (
                <Typography color="text.secondary">Dinner begins at {availableDinnerTime}.</Typography>
              ) : null}
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {suggestedDates.map((dateKey) => (
                  <Button
                    key={dateKey}
                    variant="outlined"
                    size="small"
                    onClick={() => onSelectSuggestedDate(dateKey)}
                  >
                    {formatHumanDate(dateKey)}
                  </Button>
                ))}
              </Stack>
            </>
          ) : (
            <Stack spacing={1}>
              {isDateOpen ? (
                <>
                  {availableDinnerTime ? (
                    <Typography color="text.secondary">Dinner begins at {availableDinnerTime}.</Typography>
                  ) : null}
                  <Typography color="text.secondary">This night is currently open for reservations.</Typography>
                </>
              ) : (
                <Typography color="text.secondary">No reservation dates are available in the next 2 months.</Typography>
              )}
            </Stack>
          )}
        </Stack>
      )}
    </SurfaceCard>
  );
}

export default DayReservationsCard;
