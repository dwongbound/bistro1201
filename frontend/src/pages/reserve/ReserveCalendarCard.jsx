import { Box, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import SurfaceCard from '../../common/SurfaceCard';
import { formatDateKey, formatHumanDate, isPastDate, isValidDateValue, weekdays } from './reserve';

/**
 * Renders the interactive month view used to browse open reservation nights.
 */
function ReserveCalendarCard({
  availableDateSet,
  availabilityByDate,
  bookableAvailabilityByDate,
  bookableDateSet,
  calendarDays,
  currentMonth,
  loadingDashboard,
  onDaySelect,
  onMonthChange,
  reservationsByDate,
  selectedDate,
  today,
}) {
  return (
    <SurfaceCard cardSx={{ height: '100%' }} contentSx={{ p: { xs: 2, sm: 3 } }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Calendar
          </Typography>
          <Typography color="text.secondary">
            Find an open slot and reserve in Guest Reservation box.
          </Typography>
        </Box>
      </Stack>

      <Box
        sx={{
          mb: 2,
          width: '100%',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
          alignItems: 'center',
          columnGap: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
          <Button
            variant="outlined"
            onClick={() => onMonthChange(-1)}
            sx={{ minWidth: { xs: 104, sm: 112 } }}
          >
            Previous
          </Button>
        </Box>
        <Typography
          variant="h6"
          sx={{ flexShrink: 0, minWidth: 'fit-content', textAlign: 'center', fontWeight: 700 }}
        >
          {(isValidDateValue(currentMonth) ? currentMonth : new Date()).toLocaleDateString(undefined, {
            month: 'long',
            year: 'numeric',
          })}
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            onClick={() => onMonthChange(1)}
            sx={{ minWidth: { xs: 104, sm: 112 } }}
          >
            Next
          </Button>
        </Box>
      </Box>

      {loadingDashboard ? (
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 6 }}>
          <CircularProgress size={20} />
          <Typography color="text.secondary">Loading reserve calendar...</Typography>
        </Stack>
      ) : (
        <Box sx={{ pb: 1 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
              gap: { xs: 0.5, sm: 1 },
              alignItems: 'stretch',
              width: '100%',
            }}
          >
            {weekdays.map((weekday) => (
              <Typography
                key={weekday}
                variant="caption"
                sx={{ px: 1, py: 0.75, textAlign: 'center', fontWeight: 700, color: 'text.secondary' }}
              >
                {weekday}
              </Typography>
            ))}
            {calendarDays.map((day) => {
              const dateKey = formatDateKey(day);
              const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
              const isSelected = dateKey === selectedDate;
              const hasVisibleAvailability = availableDateSet.has(dateKey);
              const isBookable = bookableDateSet.has(dateKey);
              const dinnerTimes = availabilityByDate[dateKey]?.map((item) => item.dinner_time).filter(Boolean) || [];
              const bookableDinnerTimeSet = new Set(
                bookableAvailabilityByDate[dateKey]?.map((item) => item.dinner_time).filter(Boolean) || [],
              );
              const reservedDinnerTimeSet = new Set(reservationsByDate[dateKey]?.map((reservation) => reservation.time) || []);
              const prioritizedDinnerTimes = [
                ...dinnerTimes.filter((time) => bookableDinnerTimeSet.has(time)),
                ...dinnerTimes.filter((time) => !bookableDinnerTimeSet.has(time)),
              ].slice(0, 5);
              const isPast = isPastDate(dateKey, today);
              const isClickable = !isPast;

              return (
                <Paper
                  key={dateKey}
                  component="button"
                  type="button"
                  aria-label={formatHumanDate(dateKey)}
                  disabled={!isClickable}
                  onClick={() => {
                    if (isClickable) {
                      onDaySelect(dateKey);
                    }
                  }}
                  elevation={0}
                  sx={{
                    minWidth: 0,
                    height: { xs: 64, sm: 82, md: 96 },
                    p: { xs: 0.5, sm: 0.85, md: 1.1 },
                    border: '1px solid',
                    borderColor: isSelected ? 'rgba(255, 255, 255, 0.88)' : 'rgba(217, 195, 161, 0.15)',
                    backgroundColor: isPast
                      ? 'rgba(255, 255, 255, 0.015)'
                      : isSelected
                      ? 'rgba(255, 255, 255, 0.09)'
                      : isBookable
                        ? 'rgba(176, 122, 68, 0.16)'
                      : 'rgba(255, 255, 255, 0.02)',
                    textAlign: 'left',
                    borderRadius: 0,
                    opacity: isPast ? 0.3 : isCurrentMonth ? 1 : 0.45,
                    transition: 'all 160ms ease',
                    cursor: isClickable ? 'pointer' : 'default',
                    '&:hover': {
                      transform: isClickable ? 'translateY(-2px)' : 'none',
                      backgroundColor: !isClickable
                        ? undefined
                        : isSelected
                          ? 'rgba(255, 255, 255, 0.12)'
                          : isBookable
                            ? 'rgba(176, 122, 68, 0.12)'
                            : 'rgba(255, 255, 255, 0.05)',
                      borderColor: !isClickable
                        ? 'rgba(217, 195, 161, 0.15)'
                        : isSelected
                          ? 'rgba(255, 255, 255, 0.95)'
                          : isBookable
                            ? 'secondary.main'
                            : 'rgba(217, 195, 161, 0.28)',
                      boxShadow: isClickable ? '0 10px 22px rgba(0, 0, 0, 0.22)' : 'none',
                    },
                    '&:disabled': {
                      color: 'text.secondary',
                    },
                  }}
                >
                  <Stack spacing={{ xs: 0.5, sm: 0.9 }}>
                    <Typography
                      sx={{
                        fontWeight: 700,
                        fontSize: { xs: '0.9rem', sm: '1rem' },
                        color: isSelected ? 'common.white' : undefined,
                      }}
                    >
                      {day.getDate()}
                    </Typography>
                    {hasVisibleAvailability && prioritizedDinnerTimes.length && !isPast ? (
                      <Stack
                        direction="row"
                        alignItems="center"
                        spacing={0.5}
                        sx={{
                          pointerEvents: 'none',
                          flexWrap: 'wrap',
                          minHeight: { xs: 12, sm: 14 },
                        }}
                      >
                        {prioritizedDinnerTimes.map((time, index) => {
                          const isReservedTime = reservedDinnerTimeSet.has(time);
                          const isBookableTime = bookableDinnerTimeSet.has(time);

                          return (
                            <Box
                              key={`${dateKey}-${time}-${index}`}
                              sx={{
                                width: { xs: 7, sm: 8 },
                                height: { xs: 7, sm: 8 },
                                borderRadius: '50%',
                                backgroundColor: isReservedTime || !isBookableTime
                                  ? 'transparent'
                                  : 'rgba(214, 166, 90, 0.98)',
                                border: isReservedTime || !isBookableTime
                                  ? '1px solid rgba(214, 166, 90, 0.45)'
                                  : '1px solid rgba(255, 241, 214, 0.45)',
                                boxShadow:
                                  isReservedTime || !isBookableTime ? 'none' : '0 0 0 1px rgba(0, 0, 0, 0.18)',
                              }}
                            />
                          );
                        })}
                      </Stack>
                    ) : null}
                  </Stack>
                </Paper>
              );
            })}
          </Box>
        </Box>
      )}
    </SurfaceCard>
  );
}

export default ReserveCalendarCard;
