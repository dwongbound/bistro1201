import { Box, Button, MenuItem, Popover, Stack, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { BORDER_RADIUS } from './theme';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const TIME_HOURS = Array.from({ length: 12 }, (_, index) => `${index + 1}`);
const TIME_MINUTES = ['00', '15', '30', '45'];
const TIME_PERIODS = ['AM', 'PM'];

function padNumber(value) {
  return `${value}`.padStart(2, '0');
}

function formatDateKey(date) {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
}

function parseDateKey(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildCalendarDays(monthDate) {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const firstGridDay = new Date(firstDay);
  firstGridDay.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(firstGridDay);
    day.setDate(firstGridDay.getDate() + index);
    return day;
  });
}

function parseDateTimeValue(value) {
  if (!value) {
    return { dateKey: '', timeValue: '19:00' };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { dateKey: '', timeValue: '19:00' };
  }

  return {
    dateKey: formatDateKey(parsed),
    timeValue: `${padNumber(parsed.getHours())}:${padNumber(parsed.getMinutes())}`,
  };
}

function toTwelveHourParts(timeValue = '19:00') {
  const [rawHours, rawMinutes] = timeValue.split(':').map(Number);
  const safeHours = Number.isInteger(rawHours) && rawHours >= 0 && rawHours <= 23 ? rawHours : 19;
  const safeMinutes = Number.isInteger(rawMinutes) && rawMinutes >= 0 && rawMinutes <= 59 ? rawMinutes : 0;
  const period = safeHours >= 12 ? 'PM' : 'AM';
  const hour = safeHours % 12 || 12;

  return {
    hour: `${hour}`,
    minute: `${safeMinutes}`.padStart(2, '0'),
    period,
  };
}

function toTwentyFourHourValue(hour, minute, period) {
  const normalizedHour = Number(hour);
  if (!Number.isInteger(normalizedHour) || normalizedHour < 1 || normalizedHour > 12) {
    return '19:00';
  }

  let hours = normalizedHour % 12;
  if (period === 'PM') {
    hours += 12;
  }

  return `${`${hours}`.padStart(2, '0')}:${minute}`;
}

function formatDisplayValue(value, mode) {
  if (!value) {
    return mode === 'datetime' ? 'Select date and time' : 'Select a date';
  }

  if (mode === 'datetime') {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return parsed.toLocaleString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  const parsed = parseDateKey(value);
  if (!parsed) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function buildEventLikeValue(name, value) {
  return {
    target: {
      name,
      value,
    },
  };
}

function getTodayDateKey() {
  return formatDateKey(new Date());
}

/**
 * Renders a project-styled date picker popover that can be reused for date-only or date-time flows.
 */
function StyledDateInput({
  allowClear = false,
  availableDateSet,
  helperText,
  id,
  label,
  max,
  min,
  mode = 'date',
  name,
  onChange,
  fullWidth = true,
  value,
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const derivedDateTime = useMemo(() => parseDateTimeValue(value), [value]);
  const derivedDateKey = mode === 'datetime' ? derivedDateTime.dateKey : value;
  const defaultDateKey = mode === 'datetime' ? getTodayDateKey() : '';
  const [draftDateKey, setDraftDateKey] = useState(derivedDateKey || defaultDateKey);
  const [draftTimeValue, setDraftTimeValue] = useState(derivedDateTime.timeValue);
  const [viewMonth, setViewMonth] = useState(() => parseDateKey(derivedDateKey || defaultDateKey) || new Date());

  useEffect(() => {
    const nextDateKey = mode === 'datetime' ? parseDateTimeValue(value).dateKey : value;
    const nextTimeValue = mode === 'datetime' ? parseDateTimeValue(value).timeValue : '19:00';
    setDraftDateKey(nextDateKey || defaultDateKey);
    setDraftTimeValue(nextTimeValue);
    setViewMonth(parseDateKey(nextDateKey || defaultDateKey) || new Date());
  }, [defaultDateKey, mode, value]);

  const open = Boolean(anchorEl);
  const calendarDays = useMemo(() => buildCalendarDays(viewMonth), [viewMonth]);
  const draftTimeParts = useMemo(() => toTwelveHourParts(draftTimeValue), [draftTimeValue]);

  const emitValue = (nextValue) => {
    onChange(buildEventLikeValue(name, nextValue));
  };

  const closePicker = () => {
    setAnchorEl(null);
  };

  const isDateDisabled = (dateKey) => {
    if (min && dateKey < min) {
      return true;
    }
    if (max && dateKey > max) {
      return true;
    }
    return false;
  };

  const handleDateClick = (dateKey) => {
    if (isDateDisabled(dateKey)) {
      return;
    }

    if (mode === 'date') {
      emitValue(dateKey);
      closePicker();
      return;
    }

    setDraftDateKey(dateKey);
  };

  const handleApply = () => {
    if (!draftDateKey) {
      emitValue('');
      closePicker();
      return;
    }

    if (mode === 'datetime') {
      emitValue(new Date(`${draftDateKey}T${draftTimeValue || '19:00'}`).toISOString());
      closePicker();
      return;
    }

    emitValue(draftDateKey);
    closePicker();
  };

  const handleToday = () => {
    const today = formatDateKey(new Date());
    if (isDateDisabled(today)) {
      return;
    }

    if (mode === 'date') {
      emitValue(today);
      closePicker();
      return;
    }

    setDraftDateKey(today);
  };

  const displayValue = formatDisplayValue(value, mode);

  return (
    <Stack spacing={1}>
      <Typography component="label" htmlFor={id} sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
      <Box
        id={id}
        role="button"
        tabIndex={0}
        aria-label={label}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setAnchorEl(event.currentTarget);
          }
        }}
        sx={{
          position: 'relative',
          width: fullWidth ? '100%' : 'fit-content',
          minWidth: fullWidth ? 'auto' : 176,
          maxWidth: fullWidth ? 'none' : 220,
          px: 2.25,
          py: fullWidth ? 1.75 : 1.25,
          border: '1px solid',
          borderColor: 'rgba(217, 195, 161, 0.28)',
          borderRadius: `${BORDER_RADIUS}px`,
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          cursor: 'pointer',
          transition: 'border-color 140ms ease, transform 140ms ease, background-color 140ms ease',
          '&:hover': {
            borderColor: 'rgba(217, 195, 161, 0.45)',
            backgroundColor: 'rgba(255, 255, 255, 0.035)',
            transform: 'translateY(-1px)',
          },
          '&:focus-visible': {
            outline: '2px solid rgba(214, 166, 90, 0.45)',
            outlineOffset: 2,
          },
        }}
      >
        <Typography
          sx={{
            flexGrow: 1,
            fontSize: fullWidth ? '1.05rem' : '0.98rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {displayValue}
        </Typography>
      </Box>
      <input type="hidden" name={name} value={value} readOnly />
      {helperText ? <Typography color="text.secondary">{helperText}</Typography> : null}

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={closePicker}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              width: 340,
              maxWidth: 'calc(100vw - 32px)',
              p: 2,
              borderRadius: `${BORDER_RADIUS}px`,
              border: '1px solid rgba(217, 195, 161, 0.2)',
              background:
                'linear-gradient(180deg, rgba(36, 28, 22, 0.98) 0%, rgba(24, 18, 14, 0.98) 100%)',
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.35)',
              color: 'common.white',
            },
          },
        }}
      >
        <Stack spacing={2}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography sx={{ fontWeight: 700, fontSize: '1.05rem' }}>
              {viewMonth.toLocaleDateString(undefined, {
                month: 'long',
                year: 'numeric',
              })}
            </Typography>
            <Stack direction="row" spacing={0.75}>
              <Button
                size="small"
                variant="text"
                onClick={() => setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                sx={{ minWidth: 0, px: 1.25, color: 'inherit' }}
              >
                Prev
              </Button>
              <Button
                size="small"
                variant="text"
                onClick={() => setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                sx={{ minWidth: 0, px: 1.25, color: 'inherit' }}
              >
                Next
              </Button>
            </Stack>
          </Stack>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
              gap: 0.75,
            }}
          >
            {WEEKDAYS.map((weekday, index) => (
              <Typography
                key={`${weekday}-${index}`}
                variant="caption"
                sx={{ py: 0.5, textAlign: 'center', color: 'rgba(244, 232, 214, 0.72)', fontWeight: 700 }}
              >
                {weekday}
              </Typography>
            ))}
            {calendarDays.map((day) => {
              const dateKey = formatDateKey(day);
              const isCurrentMonth = day.getMonth() === viewMonth.getMonth();
              const isSelected = dateKey === draftDateKey || (mode === 'date' && dateKey === value);
              const disabled = isDateDisabled(dateKey);
              const isAvailable = availableDateSet?.has(dateKey);

              return (
                <Box
                  key={dateKey}
                  component="button"
                  type="button"
                  data-testid={dateKey}
                  aria-pressed={isSelected}
                  onClick={() => handleDateClick(dateKey)}
                  disabled={disabled}
                  sx={{
                    position: 'relative',
                    height: 38,
                    border: '1px solid',
                    borderColor: isSelected ? 'secondary.main' : isAvailable ? 'rgba(214, 166, 90, 0.45)' : 'rgba(217, 195, 161, 0.18)',
                    borderRadius: `${BORDER_RADIUS}px`,
                    backgroundColor: isSelected ? 'secondary.main' : isAvailable ? 'rgba(176, 122, 68, 0.18)' : 'rgba(255, 255, 255, 0.02)',
                    color: isSelected ? '#1a130d' : isCurrentMonth ? 'common.white' : 'rgba(244, 232, 214, 0.45)',
                    fontWeight: isSelected || isAvailable ? 700 : 500,
                    cursor: disabled ? 'default' : 'pointer',
                    opacity: disabled ? 0.3 : 1,
                    transition: 'all 140ms ease',
                    '&:hover': {
                      backgroundColor: disabled ? undefined : isSelected ? 'secondary.light' : 'rgba(214, 166, 90, 0.16)',
                      borderColor: disabled ? undefined : 'secondary.main',
                    },
                  }}
                >
                  {day.getDate()}
                  {isAvailable && !isSelected ? (
                    <Box
                      data-testid="availability-dot"
                      sx={{
                        position: 'absolute',
                        bottom: 4,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        backgroundColor: 'secondary.main',
                      }}
                    />
                  ) : null}
                </Box>
              );
            })}
          </Box>

          {mode === 'datetime' ? (
            <Stack spacing={1}>
              <Typography sx={{ fontWeight: 600 }}>Expiration Time</Typography>
              <Stack direction="row" spacing={1}>
                <TextField
                  select
                  label="Hour"
                  value={draftTimeParts.hour}
                  onChange={(event) =>
                    setDraftTimeValue(
                      toTwentyFourHourValue(event.target.value, draftTimeParts.minute, draftTimeParts.period),
                    )
                  }
                  sx={timeSelectSx}
                >
                  {TIME_HOURS.map((hour) => (
                    <MenuItem key={hour} value={hour}>
                      {hour}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Minute"
                  value={draftTimeParts.minute}
                  onChange={(event) =>
                    setDraftTimeValue(
                      toTwentyFourHourValue(draftTimeParts.hour, event.target.value, draftTimeParts.period),
                    )
                  }
                  sx={timeSelectSx}
                >
                  {TIME_MINUTES.map((minute) => (
                    <MenuItem key={minute} value={minute}>
                      {minute}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="AM / PM"
                  value={draftTimeParts.period}
                  onChange={(event) =>
                    setDraftTimeValue(
                      toTwentyFourHourValue(draftTimeParts.hour, draftTimeParts.minute, event.target.value),
                    )
                  }
                  sx={timeSelectSx}
                >
                  {TIME_PERIODS.map((period) => (
                    <MenuItem key={period} value={period}>
                      {period}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
            </Stack>
          ) : null}

          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
            <Button variant="text" onClick={closePicker} sx={{ color: 'rgba(244, 232, 214, 0.8)' }}>
              Cancel
            </Button>
            <Button variant="text" color="secondary" onClick={handleToday}>
              Today
            </Button>
            {mode === 'datetime' ? (
              <Button variant="contained" onClick={handleApply}>
                Apply
              </Button>
            ) : (
              <Box sx={{ width: 64 }} />
            )}
          </Stack>
        </Stack>
      </Popover>
    </Stack>
  );
}

export default StyledDateInput;

const timeSelectSx = {
  minWidth: 0,
  flex: 1,
  '& .MuiInputLabel-root': {
    color: 'rgba(244, 232, 214, 0.72)',
  },
  '& .MuiInputLabel-root.Mui-focused': {
    color: 'secondary.main',
  },
  '& .MuiOutlinedInput-root': {
    borderRadius: `${BORDER_RADIUS}px`,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    color: 'common.white',
    '& fieldset': {
      borderColor: 'rgba(217, 195, 161, 0.22)',
    },
    '&:hover fieldset': {
      borderColor: 'rgba(217, 195, 161, 0.38)',
    },
    '&.Mui-focused fieldset': {
      borderColor: 'secondary.main',
    },
  },
  '& .MuiSvgIcon-root': {
    color: 'rgba(244, 232, 214, 0.72)',
  },
  '& .MuiSelect-select': {
    color: 'common.white',
  },
};
