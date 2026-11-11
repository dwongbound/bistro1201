import FormField from '../../common/FormField';
import { useFormErrors } from '../../common/useFormErrors';
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
  const { errors, validate, clearError } = useFormErrors();

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!validate({ name: form.name, email: form.email })) {
      return;
    }
    onSubmit(event);
  };

  let timeHint = 'There are no availabilities for this day.';
  if (bookableDinnerTimes.length && selectedDinnerTime) {
    timeHint = `Selected time: ${formatHumanTime(selectedDinnerTime)}`;
  } else if (bookableDinnerTimes.length) {
    timeHint = 'Select one dinner seating shown for this night.';
  } else if (nextAvailableSlotLabel) {
    timeHint = `There are no availabilities for this day. Next available slot is ${nextAvailableSlotLabel}.`;
  }

  const canSubmit = hasAvailability
    && Boolean(form.date)
    && Boolean(form.time)
    && Boolean(form.name.trim())
    && Boolean(form.email.trim())
    && availableDateSet.has(form.date);

  return (
    <section className="panel grid gap-6">
      <div className="grid gap-1">
        <p className="eyebrow">Your table</p>
        <h2 className="font-display text-2xl tracking-tight">Guest Reservation</h2>
      </div>
      <form onSubmit={handleSubmit} noValidate className="grid gap-5">
        <StyledDateInput
          id="reservation-date"
          label="Date *"
          name="date"
          onChange={onInputChange}
          value={form.date}
          availableDateSet={availableDateSet}
          disablePast
        />

        <div className="grid gap-3">
          <label htmlFor="reservation-time" className="text-sm font-medium text-cream/90">
            Time *
          </label>
          {selectedDinnerTimes.length ? (
            <div className="flex flex-wrap gap-2">
              {selectedDinnerTimes.map((time) => {
                const isBookable = bookableDinnerTimes.includes(time);
                const isSelected = selectedDinnerTime === time;
                const label = formatHumanTime(time);

                if (!isBookable) {
                  return (
                    <span key={time} className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm text-muted line-through decoration-muted/60">
                      {label}
                    </span>
                  );
                }

                let chipClass = 'border-line-strong text-cream hover:border-sand hover:bg-white/5';
                if (isSelected) {
                  chipClass = 'border-sand bg-sand text-ink-950';
                }
                return (
                  <button
                    key={time}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onTimeSelect(time)}
                    className={`inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-semibold transition-colors ${chipClass}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ) : null}
          <p className="text-sm text-muted">{timeHint}</p>
          <input id="reservation-time" type="hidden" name="time" value={form.time} readOnly />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <FormField
            id="reservation-name"
            label="Name"
            type="text"
            name="name"
            autoComplete="name"
            value={form.name}
            onChange={(event) => {
              clearError('name');
              onInputChange(event);
            }}
            invalid={Boolean(errors.name)}
          />
          <FormField
            id="reservation-email"
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            value={form.email}
            onChange={(event) => {
              clearError('email');
              onInputChange(event);
            }}
            invalid={Boolean(errors.email)}
          />
        </div>
        <button type="submit" disabled={!canSubmit} className={`btn btn-primary ${isMobile ? 'w-full' : 'w-full sm:w-fit'}`}>
          Confirm Reservation
        </button>
      </form>
    </section>
  );
}

export default GuestReservationCard;
