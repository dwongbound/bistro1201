/**
 * Lists the weekday labels used at the top of the reserve calendar.
 */
export const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Checks whether a Date instance contains a usable calendar value.
 */
export function isValidDateValue(date) {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

/**
 * Parses a YYYY-MM-DD key into a local Date object when the value is valid.
 */
export function parseDateKey(dateString) {
  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return null;
  }

  const parsedDate = new Date(`${dateString}T00:00:00`);
  return isValidDateValue(parsedDate) ? parsedDate : null;
}

/**
 * Checks whether a YYYY-MM-DD string can be used safely throughout the reserve UI.
 */
export function isValidDateKey(dateString) {
  return Boolean(parseDateKey(dateString));
}

/**
 * Builds the six-week calendar grid shown for the currently selected month.
 */
export function createCalendarDays(monthDate) {
  const safeMonthDate = isValidDateValue(monthDate) ? monthDate : new Date();
  const year = safeMonthDate.getFullYear();
  const month = safeMonthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstGridDay = new Date(firstDay);
  firstGridDay.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(firstGridDay);
    day.setDate(firstGridDay.getDate() + index);
    return day;
  });
}

/**
 * Normalizes a Date object to the YYYY-MM-DD format used by the backend.
 */
export function formatDateKey(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Produces a human-readable label for headings and guest-facing copy.
 */
export function formatHumanDate(dateString) {
  const date = parseDateKey(dateString);

  if (!date) {
    return 'No date selected';
  }

  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Produces a guest-friendly 12-hour label like 7:00 PM from a backend HH:MM value.
 */
export function formatHumanTime(timeString) {
  if (!timeString || !/^\d{2}:\d{2}$/.test(timeString)) {
    console.error(`Invalid time string: ${timeString}`);
    return timeString || '';
  }

  const [hours, minutes] = timeString.split(':').map(Number);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    console.error(`Invalid time value: ${timeString}`);
    return timeString;
  }

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Keeps reservation data ordered exactly the way the dashboard displays it.
 */
export function sortReservations(reservations) {
  return [...reservations].sort((left, right) => {
    if (left.date === right.date) {
      return left.time.localeCompare(right.time);
    }
    return left.date.localeCompare(right.date);
  });
}

/**
 * Sorts available dates so the earliest open night is always easy to locate.
 */
export function sortAvailability(availability) {
  return availability
    .filter((entry) => isValidDateKey(entry.date))
    .sort((left, right) => {
      if (left.date === right.date) {
        return (left.dinner_time || '').localeCompare(right.dinner_time || '');
      }
      return left.date.localeCompare(right.date);
    });
}

/**
 * Chooses the next date guests should see in the reservation form.
 */
export function findNextAvailableDate(availability, today) {
  return availability.find((availableDate) => availableDate.date >= today)?.date || availability[0]?.date || '';
}

/**
 * Determines whether a calendar date is in the past relative to the current day key.
 */
export function isPastDate(dateKey, today) {
  return dateKey < today;
}

/**
 * Calculates the inclusive date key at the end of the booking lookahead window.
 */
export function buildLookaheadEndDate(today, monthsAhead = 2) {
  const startDate = parseDateKey(today);
  if (!startDate) {
    return formatDateKey(new Date());
  }

  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + monthsAhead);
  return formatDateKey(endDate);
}

/**
 * Filters open dates down to the bookable window shown to guests.
 */
export function findAvailableDatesWithinWindow(availability, today, monthsAhead = 2) {
  const windowEnd = buildLookaheadEndDate(today, monthsAhead);

  return [...new Set(availability.map((availableDate) => availableDate.date))]
    .filter((dateKey) => dateKey >= today && dateKey <= windowEnd)
    .sort((left, right) => left.localeCompare(right));
}

/**
 * Chooses the next open date guests should see within the configured lookahead window.
 */
export function findNextAvailableDateWithinWindow(availability, today, monthsAhead = 2) {
  return findAvailableDatesWithinWindow(availability, today, monthsAhead)[0] || '';
}

/**
 * Builds the clickable suggestion list shown when the selected day has no reservations yet.
 */
export function findSuggestedAvailabilityDates(availability, selectedDate, today, monthsAhead = 2, limit = 4) {
  const comparisonDate = selectedDate >= today ? selectedDate : today;

  return findAvailableDatesWithinWindow(availability, today, monthsAhead)
    .filter((dateKey) => dateKey > comparisonDate)
    .slice(0, limit);
}
