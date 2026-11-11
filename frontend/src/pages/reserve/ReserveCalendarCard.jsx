import Spinner from '../../common/Spinner';
import { ArrowLeftIcon, ArrowRightIcon } from '../../common/icons';
import { formatDateKey, formatHumanDate, isPastDate, isValidDateValue, weekdays } from './reserve';

/**
 * Picks the look of one calendar day from its state. Selected wins, then past,
 * then bookable; days outside the shown month are dimmed.
 */
function dayClass({ isSelected, isPast, isBookable, isCurrentMonth }) {
  const base = 'group relative flex h-16 min-w-0 flex-col justify-between rounded-xl border p-1.5 text-left transition-all duration-200 sm:h-20 sm:p-2.5 md:h-24';
  if (isSelected) {
    return `${base} border-sand bg-sand text-ink-950 shadow-lg shadow-sand/10`;
  }
  if (isPast) {
    return `${base} cursor-default border-transparent bg-white/[0.015] text-muted opacity-35`;
  }
  let monthClass = '';
  if (!isCurrentMonth) monthClass = 'opacity-45';
  if (isBookable) {
    return `${base} ${monthClass} border-brass/45 bg-brass/15 text-cream hover:-translate-y-0.5 hover:border-brass-bright hover:bg-brass/25`;
  }
  return `${base} ${monthClass} border-line bg-white/[0.02] text-cream/80 hover:-translate-y-0.5 hover:border-line-strong hover:bg-white/[0.05]`;
}

/**
 * Picks the dot style for one seating: filled when it can still be booked, hollow when taken.
 */
function seatingDotClass(isOpen, isSelectedDay) {
  if (isOpen && isSelectedDay) return 'bg-ink-950';
  if (isOpen) return 'bg-brass-bright';
  if (isSelectedDay) return 'border border-ink-950/50';
  return 'border border-brass/50';
}

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
  const shownMonth = isValidDateValue(currentMonth) ? currentMonth : new Date();
  const monthLabel = shownMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const monthButtonClass = 'grid size-11 place-items-center rounded-full border border-line-strong text-cream transition-colors hover:border-sand hover:bg-white/5';

  return (
    <section className="panel grid gap-6 p-4 sm:p-6 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h2 className="font-display text-2xl tracking-tight">Calendar</h2>
          <p className="text-sm text-muted">Pick a highlighted night, then choose a seating.</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-brass-bright" />Open seating</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full border border-brass/60" />Taken</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button type="button" aria-label="Previous" onClick={() => onMonthChange(-1)} className={monthButtonClass}>
          <ArrowLeftIcon className="size-4" />
        </button>
        {/* Kept as an h6: the end-to-end tests find the month label by this tag. */}
        <h6 className="font-display text-xl tracking-tight text-cream">{monthLabel}</h6>
        <button type="button" aria-label="Next" onClick={() => onMonthChange(1)} className={monthButtonClass}>
          <ArrowRightIcon className="size-4" />
        </button>
      </div>

      {loadingDashboard ? (
        <div className="py-10">
          <Spinner label="Loading reserve calendar..." />
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {weekdays.map((weekday) => (
            <span key={weekday} className="pb-1 text-center text-[11px] font-semibold tracking-[0.15em] text-muted uppercase">
              {weekday}
            </span>
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
            // Open seatings first so the dots read "available" at a glance; cap at five to fit small cells.
            const prioritizedDinnerTimes = [
              ...dinnerTimes.filter((time) => bookableDinnerTimeSet.has(time)),
              ...dinnerTimes.filter((time) => !bookableDinnerTimeSet.has(time)),
            ].slice(0, 5);
            const isPast = isPastDate(dateKey, today);
            const showDots = hasVisibleAvailability && prioritizedDinnerTimes.length > 0 && !isPast;

            return (
              <button
                key={dateKey}
                type="button"
                aria-label={formatHumanDate(dateKey)}
                aria-pressed={isSelected}
                disabled={isPast}
                onClick={() => {
                  if (!isPast) {
                    onDaySelect(dateKey);
                  }
                }}
                className={dayClass({ isSelected, isPast, isBookable, isCurrentMonth })}
              >
                <span className="text-sm font-semibold sm:text-base">{day.getDate()}</span>
                {showDots ? (
                  <span className="pointer-events-none flex flex-wrap gap-1">
                    {prioritizedDinnerTimes.map((time, index) => {
                      const isOpen = !reservedDinnerTimeSet.has(time) && bookableDinnerTimeSet.has(time);
                      return (
                        <span
                          key={`${dateKey}-${time}-${index}`}
                          className={`size-1.5 rounded-full sm:size-2 ${seatingDotClass(isOpen, isSelected)}`}
                        />
                      );
                    })}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default ReserveCalendarCard;
