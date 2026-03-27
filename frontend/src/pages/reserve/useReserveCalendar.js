import { useEffect, useMemo, useState } from 'react';
import {
  createCalendarDays,
  findSuggestedAvailabilityDates,
  formatDateKey,
  isPastDate,
  parseDateKey,
} from './reserve';

/**
 * Centralizes reserve-calendar state so the page component can focus on API flow and forms.
 */
function useReserveCalendar({ availability, isStaff }) {
  const today = formatDateKey(new Date());
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [hasUserSelectedDate, setHasUserSelectedDate] = useState(false);

  const availableDateSet = useMemo(
    () => new Set(availability.map((availableDate) => availableDate.date)),
    [availability],
  );
  const suggestedAvailabilityDates = useMemo(
    () => findSuggestedAvailabilityDates(availability, selectedDate, today),
    [availability, selectedDate, today],
  );
  const calendarDays = useMemo(() => createCalendarDays(currentMonth), [currentMonth]);
  const hasAvailability = availability.length > 0;

  useEffect(() => {
    if (isStaff) {
      return;
    }

    if (!hasUserSelectedDate && selectedDate !== today) {
      setSelectedDate(today);
      setCurrentMonth(parseDateKey(today) || new Date());
      return;
    }

    if (isPastDate(selectedDate, today)) {
      // When no dates are open, keep the guest view anchored to today instead of drifting into the past.
      setSelectedDate(today);
      setCurrentMonth(parseDateKey(today) || new Date());
    }
  }, [hasUserSelectedDate, isStaff, selectedDate, today]);

  /**
   * Keeps all calendar-adjacent state aligned when a new date is chosen from any UI control.
   */
  const selectDate = (dateKey) => {
    setHasUserSelectedDate(true);
    setSelectedDate(dateKey);
    setCurrentMonth(parseDateKey(dateKey) || new Date());
  };

  /**
   * Advances the displayed month in either direction for the calendar pager.
   */
  const changeMonth = (offset) => {
    setCurrentMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  return {
    availableDateSet,
    calendarDays,
    changeMonth,
    currentMonth,
    hasAvailability,
    selectDate,
    selectedDate,
    suggestedAvailabilityDates,
    today,
  };
}

export default useReserveCalendar;
