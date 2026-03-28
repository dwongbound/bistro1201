import { Alert, Box, Button, Grid, Stack, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useEffect, useMemo, useState } from 'react';
import { createApiFetch } from '../../common/apiClient';
import { getApiUrl } from '../../common/appConfig';
import PageIntro from '../../common/PageIntro';
import {
  clearGuestAccessCode,
  clearStaffAccessCode,
  readGuestAccessCode,
  readStaffAccessCode,
  saveGuestAccessCode,
  saveStaffAccessCode,
} from '../../common/reserveAccessCookie';
import GuestReservationCard from './GuestReservationCard';
import ReservationConfirmationDialog from './ReservationConfirmationDialog';
import ReserveAccessGate from './ReserveAccessGate';
import ReserveCalendarCard from './ReserveCalendarCard';
import StaffControlsCard from './StaffControlsCard';
import useReserveCalendar from './useReserveCalendar';
import { formatDateKey, formatHumanDate, formatHumanTime, sortAvailability, sortReservations } from './reserve';

function sortAccessCodes(accessCodes) {
  return [...accessCodes].sort((left, right) => {
    if ((right.created_at || 0) !== (left.created_at || 0)) {
      return (right.created_at || 0) - (left.created_at || 0);
    }
    return left.code.localeCompare(right.code);
  });
}

/**
 * Renders the protected reserve dashboard used by both guests and staff.
 */
function Scheduling() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const apiUrl = getApiUrl();

  const today = formatDateKey(new Date());
  const [auth, setAuth] = useState({ token: '', role: '' });
  const [accessCode, setAccessCode] = useState('');
  const [staffAccessCode, setStaffAccessCode] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [reservations, setReservations] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [guestCookieChecked, setGuestCookieChecked] = useState(false);
  const [staffCookieChecked, setStaffCookieChecked] = useState(false);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [accessCodes, setAccessCodes] = useState([]);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [authStatus, setAuthStatus] = useState({ type: '', message: '' });
  const [staffStatus, setStaffStatus] = useState({ type: '', message: '' });
  const [staffBusy, setStaffBusy] = useState(false);
  const [accessCodeBusy, setAccessCodeBusy] = useState(false);
  const [confirmationDialog, setConfirmationDialog] = useState({ open: false, title: '', message: '' });
  const [form, setForm] = useState({
    date: today,
    time: '',
    name: '',
    email: '',
  });
  const reservationsByDate = useMemo(() => {
    return reservations.reduce((grouped, reservation) => {
      if (!grouped[reservation.date]) {
        grouped[reservation.date] = [];
      }
      grouped[reservation.date].push(reservation);
      return grouped;
    }, {});
  }, [reservations]);
  const reservedSlotSet = useMemo(() => {
    return new Set(reservations.map((reservation) => `${reservation.date}::${reservation.time}`));
  }, [reservations]);
  const guestAvailability = useMemo(() => {
    return availability.filter(
      (availableDate) =>
        !reservedSlotSet.has(`${availableDate.date}::${availableDate.dinner_time || ''}`),
    );
  }, [availability, reservedSlotSet]);
  const guestBookableDateSet = useMemo(
    () => new Set(guestAvailability.map((availableDate) => availableDate.date)),
    [guestAvailability],
  );
  const visibleAvailableDateSet = useMemo(
    () => new Set(availability.map((availableDate) => availableDate.date)),
    [availability],
  );
  const {
    availableDateSet,
    calendarDays,
    changeMonth,
    currentMonth,
    hasAvailability,
    selectDate,
    selectedDate,
    suggestedAvailabilityDates,
  } = useReserveCalendar({
    availability: auth.role === 'staff' ? availability : guestAvailability,
    isStaff: auth.role === 'staff',
  });

  /**
   * Updates the in-memory session created by the backend login endpoint.
   */
  const updateAuth = (nextAuth) => {
    setAuth(nextAuth);
  };

  /**
   * Clears the in-memory session when the backend rejects the token.
   */
  const clearAuth = (message = 'Your reserve session has expired. Please enter a valid access code.') => {
    updateAuth({ token: '', role: '' });
    setReservations([]);
    setAvailability([]);
    setAccessCodes([]);
    setAuthStatus({ type: 'error', message });
    setGuestCookieChecked(false);
    setStaffCookieChecked(false);
  };

  /**
   * Sends authenticated requests through one shared helper so token handling stays consistent.
   */
  const apiFetch = createApiFetch({
    apiUrl,
    getToken: () => auth.token,
    onUnauthorized: () => clearAuth(),
  });

  /**
   * Loads reservations and open dates after a valid session has been established.
   */
  const loadDashboard = async (tokenOverride) => {
    if (!(tokenOverride || auth.token)) {
      return;
    }

    setLoadingDashboard(true);
    try {
      const [reservationsResponse, availabilityResponse] = await Promise.all([
        apiFetch('/reservations', {}, tokenOverride),
        apiFetch('/availability', {}, tokenOverride),
      ]);

      if (!reservationsResponse.ok || !availabilityResponse.ok) {
        throw new Error('Failed to load reserve dashboard');
      }

      const [reservationPayload, availabilityPayload] = await Promise.all([
        reservationsResponse.json(),
        availabilityResponse.json(),
      ]);

      setReservations(sortReservations(reservationPayload));
      setAvailability(sortAvailability(availabilityPayload));
      setStatus({ type: '', message: '' });
    } catch (error) {
      console.error('Error loading reserve dashboard:', error);
      setStatus({ type: 'error', message: 'Unable to load the reserve calendar right now.' });
    } finally {
      setLoadingDashboard(false);
    }
  };

  useEffect(() => {
    if (!auth.token) {
      return;
    }

    // The dashboard data is only meaningful once the backend has issued a token.
    loadDashboard();
  }, [auth.token]);

  const loadAccessCodes = async (tokenOverride) => {
    if (!((tokenOverride || auth.token) && (auth.role === 'staff' || tokenOverride))) {
      return;
    }

    try {
      const response = await apiFetch('/access-codes', {}, tokenOverride);
      if (!response.ok) {
        throw new Error('Failed to load access codes');
      }

      const payload = await response.json();
      setAccessCodes(sortAccessCodes(payload));
    } catch (error) {
      console.error('Error loading access codes:', error);
      setStaffStatus({ type: 'error', message: 'Unable to load guest access codes right now.' });
    }
  };

  useEffect(() => {
    if (auth.role !== 'staff' || !auth.token) {
      setAccessCodes([]);
      return;
    }

    loadAccessCodes();
  }, [auth.role, auth.token]);

  const availabilityByDate = useMemo(() => {
    return availability.reduce((grouped, availableDate) => {
      if (!grouped[availableDate.date]) {
        grouped[availableDate.date] = [];
      }
      grouped[availableDate.date].push(availableDate);
      return grouped;
    }, {});
  }, [availability]);
  const guestAvailabilityByDate = useMemo(() => {
    return guestAvailability.reduce((grouped, availableDate) => {
      if (!grouped[availableDate.date]) {
        grouped[availableDate.date] = [];
      }
      grouped[availableDate.date].push(availableDate);
      return grouped;
    }, {});
  }, [guestAvailability]);

  const selectedAvailability = availabilityByDate[selectedDate] || [];
  const selectedDinnerTime = form.time;
  const selectedDinnerTimes = selectedAvailability
    .map((availableDate) => availableDate.dinner_time || '')
    .filter(Boolean);
  const selectedDinnerTimeSet = new Set(selectedDinnerTimes);
  const selectedReservedDinnerTimes = [
    ...new Set(
      (reservationsByDate[selectedDate] || [])
        .map((reservation) => reservation.time)
        .filter((time) => time && selectedDinnerTimeSet.has(time)),
    ),
  ];
  const bookableDinnerTimes =
    guestAvailabilityByDate[form.date]?.map((availableDate) => availableDate.dinner_time).filter(Boolean) || [];
  const nextAvailableSlotLabel = useMemo(() => {
    const nextAvailableSlot = guestAvailability.find((availableDate) => availableDate.date > form.date);
    if (!nextAvailableSlot?.date || !nextAvailableSlot?.dinner_time) {
      return '';
    }

    return `${formatHumanDate(nextAvailableSlot.date)} at ${formatHumanTime(nextAvailableSlot.dinner_time)}`;
  }, [form.date, guestAvailability]);
  const isStaff = auth.role === 'staff';

  useEffect(() => {
    // Keep the guest form aligned with the calendar selection instead of jumping to the next open night.
    setForm((currentForm) => {
      const nextTimeOptions =
        guestAvailabilityByDate[selectedDate]?.map((availableDate) => availableDate.dinner_time).filter(Boolean) || [];
      const nextTime = nextTimeOptions.includes(currentForm.time) ? currentForm.time : nextTimeOptions[0] || '';

      return {
        ...currentForm,
        date: selectedDate,
        time: nextTime,
      };
    });
  }, [guestAvailabilityByDate, selectedDate]);

  /**
   * Exchanges guest or staff access codes for backend-issued bearer tokens.
   */
  const submitAccessCode = async ({
    submittedCode,
    upgradeToStaff = false,
    persistGuestCookie = false,
    persistStaffCookie = false,
    showErrors = true,
  }) => {
    const trimmedCode = submittedCode.trim();
    if (!trimmedCode) {
      if (showErrors) {
        setAuthStatus({ type: 'error', message: 'Enter an access code to continue.' });
      }
      return false;
    }

    setAuthBusy(true);
    if (showErrors) {
      setAuthStatus({ type: '', message: '' });
    }
    if (upgradeToStaff) {
      setStaffStatus({ type: '', message: '' });
    }

    try {
      // The backend mints the session token so the raw access code never needs to live in the built app.
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmedCode }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Invalid access code' }));
        const message = payload.error || 'Invalid access code';
        if (!upgradeToStaff && !showErrors) {
          clearGuestAccessCode();
          clearStaffAccessCode();
        }
        if (upgradeToStaff && !showErrors) {
          clearStaffAccessCode();
        }
        if (upgradeToStaff) {
          setStaffStatus({ type: 'error', message });
        } else if (showErrors) {
          setAuthStatus({ type: 'error', message });
        }
        return false;
      }

      const payload = await response.json();
      updateAuth(payload);
      setAccessCode('');
      setStaffAccessCode('');
      if (!upgradeToStaff) {
        if (persistGuestCookie) {
          saveGuestAccessCode(trimmedCode);
        }
        setGuestCookieChecked(true);
        setStaffCookieChecked(false);
      }

      if (upgradeToStaff) {
        if (persistStaffCookie) {
          saveStaffAccessCode(trimmedCode);
        }
        setStaffCookieChecked(true);
        setStaffStatus({ type: '', message: '' });
        setAuthStatus({ type: '', message: '' });
      }
      return true;
    } catch (error) {
      console.error('Error signing in to reserve:', error);
      const message = 'Unable to validate your access code right now.';
      if (upgradeToStaff) {
        setStaffStatus({ type: 'error', message });
      } else if (showErrors) {
        setAuthStatus({ type: 'error', message });
      }
      return false;
    } finally {
      setAuthBusy(false);
    }
  };

  /**
   * Signs a guest into the reserve dashboard.
   */
  const handleGuestAccessSubmit = async (event) => {
    event.preventDefault();
    await submitAccessCode({
      submittedCode: accessCode,
      persistGuestCookie: true,
    });
  };

  /**
   * Elevates a guest session to staff permissions for date management actions.
   */
  const handleStaffUpgradeSubmit = async (event) => {
    event.preventDefault();
    await submitAccessCode({
      submittedCode: staffAccessCode,
      upgradeToStaff: true,
      persistStaffCookie: true,
    });
  };

  useEffect(() => {
    if (auth.token || guestCookieChecked) {
      return;
    }

    const rememberedCode = readGuestAccessCode();
    if (!rememberedCode) {
      setGuestCookieChecked(true);
      return;
    }

    const reauthenticateWithCookie = async () => {
      const loginSucceeded = await submitAccessCode({
        submittedCode: rememberedCode,
        persistGuestCookie: true,
        showErrors: false,
      });

      if (!loginSucceeded) {
        clearGuestAccessCode();
        setGuestCookieChecked(true);
      }
    };

    reauthenticateWithCookie();
  }, [auth.token, guestCookieChecked]);

  useEffect(() => {
    if (!auth.token || auth.role !== 'guest' || staffCookieChecked) {
      return;
    }

    const rememberedStaffCode = readStaffAccessCode();
    if (!rememberedStaffCode) {
      setStaffCookieChecked(true);
      return;
    }

    const reauthenticateStaffWithCookie = async () => {
      const loginSucceeded = await submitAccessCode({
        submittedCode: rememberedStaffCode,
        upgradeToStaff: true,
        persistStaffCookie: true,
        showErrors: false,
      });

      if (!loginSucceeded) {
        clearStaffAccessCode();
        setStaffCookieChecked(true);
      }
    };

    reauthenticateStaffWithCookie();
  }, [auth.role, auth.token, staffCookieChecked]);

  const handleSignOut = () => {
    clearGuestAccessCode();
    clearStaffAccessCode();
    clearAuth('You have been signed out of reserve access.');
    setGuestCookieChecked(true);
    setStaffCookieChecked(true);
  };

  /**
   * Creates a reservation once the guest has filled out the booking form.
   */
  const handleBookingSubmit = async (event) => {
    event.preventDefault();
    setStatus({ type: '', message: '' });

    if (!guestBookableDateSet.has(form.date)) {
      setStatus({ type: 'error', message: 'Please choose a date that is currently open for reservations.' });
      return;
    }
    if (!bookableDinnerTimes.includes(form.time)) {
      setStatus({ type: 'error', message: 'Please choose a dinner time that is still available.' });
      return;
    }

    try {
      const response = await apiFetch('/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Failed to book reservation' }));
        setStatus({ type: 'error', message: payload.error || 'Failed to book reservation' });
        return;
      }

      const payload = await response.json();
      const savedReservation = payload.reservation;
      setReservations((current) => sortReservations([...current, savedReservation]));
      selectDate(savedReservation.date);
      setStatus({ type: '', message: '' });
      setConfirmationDialog({
        open: true,
        title: 'Reservation Confirmed',
        message: payload.confirmation_email_sent
          ? 'Your reservation is confirmed, and a confirmation email has been sent.'
          : 'Your reservation is confirmed. Email confirmation is not configured yet.',
      });
      setForm((currentForm) => ({
        ...currentForm,
        date: savedReservation.date,
        time: '',
        name: '',
        email: '',
      }));
    } catch (error) {
      console.error('Error booking reservation:', error);
      setStatus({ type: 'error', message: 'Error booking reservation' });
    }
  };

  /**
   * Keeps the booking form and the selected calendar date aligned when the guest edits fields.
   */
  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
      ...(name === 'date'
        ? {
            time: guestAvailabilityByDate[value]?.[0]?.dinner_time || '',
          }
        : {}),
    }));
    if (name === 'date' && value) {
      selectDate(value);
    }
  };

  /**
   * Lets the calendar and the reservation form move together without duplicating sync logic.
   */
  const handleDateSelection = (dateKey) => {
    selectDate(dateKey);
    setForm((currentForm) => ({
      ...currentForm,
      date: dateKey,
      time: guestAvailabilityByDate[dateKey]?.[0]?.dinner_time || '',
    }));
  };

  /**
   * Lets guests switch between multiple open dinner seatings on the same date.
   */
  const handleTimeSelection = (time) => {
    setForm((currentForm) => ({
      ...currentForm,
      time,
    }));
  };

  /**
   * Opens or closes the currently selected date for reservations.
   */
  const setAvailabilityForSelectedDate = async (shouldOpen, dinnerTime = '') => {
    setStaffBusy(true);
    setStaffStatus({ type: '', message: '' });

    if (shouldOpen && !dinnerTime.trim()) {
      setStaffStatus({ type: 'error', message: 'Please choose a dinner time before opening the date.' });
      setStaffBusy(false);
      return false;
    }

    if (!shouldOpen && !dinnerTime.trim()) {
      setStaffStatus({ type: 'error', message: 'Please choose a dinner time before removing the slot.' });
      setStaffBusy(false);
      return false;
    }

    try {
      const response = await apiFetch(
        shouldOpen ? '/availability' : `/availability/${selectedDate}?dinner_time=${encodeURIComponent(dinnerTime)}`,
        shouldOpen
          ? {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ date: selectedDate, dinner_time: dinnerTime }),
            }
          : { method: 'DELETE' },
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Unable to update availability right now.' }));
        throw new Error(payload.error || 'Unable to update availability right now.');
      }

      const payload = await response.json();

      if (shouldOpen) {
        setAvailability((current) => {
          const alreadyExists = current.some(
            (item) => item.date === selectedDate && item.dinner_time === dinnerTime,
          );
          if (alreadyExists) {
            return current;
          }
          return sortAvailability([...current, { date: selectedDate, dinner_time: dinnerTime }]);
        });
        setStaffStatus({ type: 'success', message: `${formatHumanDate(selectedDate)} now includes a ${dinnerTime} seating.` });
        setForm((currentForm) =>
          currentForm.date === selectedDate
            ? {
                ...currentForm,
                time: dinnerTime,
              }
            : currentForm,
        );
      } else {
        setAvailability((current) =>
          current.filter((item) => !(item.date === selectedDate && item.dinner_time === dinnerTime)),
        );
        if (payload?.removed_reservation) {
          const removedReservation = payload.removed_reservation;
          setReservations((current) =>
            current.filter((reservation) =>
              removedReservation.id != null && reservation.id != null
                ? reservation.id !== removedReservation.id
                : !(
                    reservation.date === removedReservation.date &&
                    reservation.time === removedReservation.time &&
                    reservation.email === removedReservation.email &&
                    reservation.name === removedReservation.name
                  ),
            ),
          );
          setConfirmationDialog({
            open: true,
            title: 'Cancellation Sent',
            message: payload.cancellation_email_sent
              ? `The ${formatHumanTime(dinnerTime)} reservation has been released and a cancellation email has been sent.`
              : `The ${formatHumanTime(dinnerTime)} reservation has been released. No cancellation email was sent because email is not configured or the reservation had no email address.`,
          });
        }
        setStaffStatus({ type: 'success', message: `${formatHumanDate(selectedDate)} no longer includes a ${dinnerTime} seating.` });
        setForm((currentForm) =>
          currentForm.date === selectedDate && currentForm.time === dinnerTime
            ? {
                ...currentForm,
                time: '',
              }
            : currentForm,
        );
      }
      return true;
    } catch (error) {
      console.error('Error updating availability:', error);
      setStaffStatus({ type: 'error', message: error.message || 'Unable to update availability right now.' });
      return false;
    } finally {
      setStaffBusy(false);
    }
  };

  const handleCreateAccessCode = async ({ code, expiresAt }) => {
    setAccessCodeBusy(true);
    setStaffStatus({ type: '', message: '' });

    try {
      const response = await apiFetch('/access-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          expires_at: expiresAt || '',
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Unable to save access code right now.' }));
        throw new Error(payload.error || 'Unable to save access code right now.');
      }

      const saved = await response.json();
      setAccessCodes((current) => sortAccessCodes([saved, ...current.filter((item) => item.code !== saved.code)]));
      setStaffStatus({ type: 'success', message: `Guest access code ${saved.code} has been saved.` });
      return true;
    } catch (error) {
      console.error('Error saving access code:', error);
      setStaffStatus({ type: 'error', message: error.message || 'Unable to save access code right now.' });
      return false;
    } finally {
      setAccessCodeBusy(false);
    }
  };

  const handleDeleteAccessCode = async (code) => {
    setAccessCodeBusy(true);
    setStaffStatus({ type: '', message: '' });

    try {
      const response = await apiFetch(`/access-codes/${encodeURIComponent(code)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Unable to delete access code right now.' }));
        throw new Error(payload.error || 'Unable to delete access code right now.');
      }

      const removed = await response.json();
      setAccessCodes((current) => current.filter((item) => item.code !== removed.code));
      setStaffStatus({ type: 'success', message: `Guest access code ${removed.code} has been removed.` });
      return true;
    } catch (error) {
      console.error('Error deleting access code:', error);
      setStaffStatus({ type: 'error', message: error.message || 'Unable to delete access code right now.' });
      return false;
    } finally {
      setAccessCodeBusy(false);
    }
  };

  const handleFreeSlot = async (time) => {
    setStaffBusy(true);
    setStaffStatus({ type: '', message: '' });

    try {
      const response = await apiFetch(`/reservations/${selectedDate}?time=${encodeURIComponent(time)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Unable to free slot right now.' }));
        throw new Error(payload.error || 'Unable to free slot right now.');
      }

      const payload = await response.json();
      const freedReservation = payload.reservation;

      setReservations((current) =>
        current.filter((reservation) => {
          if (freedReservation.id != null && reservation.id != null) {
            return reservation.id !== freedReservation.id;
          }

          return !(
            reservation.date === freedReservation.date &&
            reservation.time === freedReservation.time &&
            reservation.email === freedReservation.email &&
            reservation.name === freedReservation.name
          );
        }),
      );
      setStaffStatus({
        type: 'success',
        message: `${formatHumanDate(selectedDate)} now has an open ${time} seating again.`,
      });
      setConfirmationDialog({
        open: true,
        title: 'Cancellation Sent',
        message: payload.cancellation_email_sent
          ? `The ${time} reservation has been released and a cancellation email has been sent.`
          : `The ${time} reservation has been released. No cancellation email was sent because email is not configured or the reservation had no email address.`,
      });
      return true;
    } catch (error) {
      console.error('Error freeing reserved slot:', error);
      setStaffStatus({ type: 'error', message: error.message || 'Unable to free slot right now.' });
      return false;
    } finally {
      setStaffBusy(false);
    }
  };

  if (!auth.token) {
    return (
      <ReserveAccessGate
        accessCode={accessCode}
        authBusy={authBusy}
        authStatus={authStatus}
        onAccessCodeChange={(event) => setAccessCode(event.target.value)}
        onSubmit={handleGuestAccessSubmit}
      />
    );
  }

  return (
    <Box sx={{ display: 'grid', gap: 4 }}>
      <PageIntro
        eyebrow="Reserve"
        title="Reserve an Evening"
        description="This webpage is kept up to date with the latest open availabilities."
        titleProps={{ sx: { maxWidth: 760 } }}
        descriptionProps={{ sx: { maxWidth: 760 } }}
      />

      {authStatus.message ? (
        <Alert severity={authStatus.type === 'error' ? 'error' : 'success'}>
          {authStatus.message}
        </Alert>
      ) : null}

      {status.message ? (
        <Alert
          severity={status.type === 'error' ? 'error' : 'success'}
          role={status.type === 'error' ? 'alert' : 'status'}
        >
          {status.message}
        </Alert>
      ) : null}

      <Grid container spacing={3}>
        {!isMobile ? (
          <Grid size={{ xs: 12, lg: 7 }}>
            <ReserveCalendarCard
              availableDateSet={visibleAvailableDateSet}
              availabilityByDate={availabilityByDate}
              bookableAvailabilityByDate={guestAvailabilityByDate}
              bookableDateSet={guestBookableDateSet}
              calendarDays={calendarDays}
              currentMonth={currentMonth}
              isMobile={isMobile}
              loadingDashboard={loadingDashboard}
              onDaySelect={handleDateSelection}
              onMonthChange={changeMonth}
              reservationsByDate={reservationsByDate}
              selectedDate={selectedDate}
              today={today}
            />
          </Grid>
        ) : null}

        <Grid size={{ xs: 12, lg: 5 }}>
          <Stack spacing={3}>
            <GuestReservationCard
              availableDateSet={guestBookableDateSet}
              bookableDinnerTimes={bookableDinnerTimes}
              form={form}
              hasAvailability={hasAvailability}
              isMobile={isMobile}
              nextAvailableSlotLabel={nextAvailableSlotLabel}
              onInputChange={handleInputChange}
              onSubmit={handleBookingSubmit}
              onTimeSelect={handleTimeSelection}
              selectedDinnerTime={selectedDinnerTime}
              selectedDinnerTimes={availabilityByDate[form.date]?.map((item) => item.dinner_time).filter(Boolean) || []}
            />

            <StaffControlsCard
              accessCodeBusy={accessCodeBusy}
              accessCodes={accessCodes}
              authBusy={authBusy}
              hasAvailabilityOnSelectedDate={Boolean(availabilityByDate[selectedDate]?.length)}
              isMobile={isMobile}
              isStaff={isStaff}
              onCreateAccessCode={handleCreateAccessCode}
              onCloseDate={(dinnerTime) => setAvailabilityForSelectedDate(false, dinnerTime)}
              onDeleteAccessCode={handleDeleteAccessCode}
              onFreeSlot={handleFreeSlot}
              onOpenDate={(dinnerTime) => setAvailabilityForSelectedDate(true, dinnerTime)}
              onStaffAccessCodeChange={(event) => setStaffAccessCode(event.target.value)}
              onUnlockStaff={handleStaffUpgradeSubmit}
              reservedDinnerTimes={selectedReservedDinnerTimes}
              selectedDate={selectedDate}
              selectedDinnerTime={selectedDinnerTime}
              selectedDinnerTimes={availabilityByDate[selectedDate]?.map((item) => item.dinner_time).filter(Boolean) || []}
              staffAccessCode={staffAccessCode}
              staffBusy={staffBusy}
              staffStatus={staffStatus}
            />
          </Stack>
        </Grid>
      </Grid>
      <ReservationConfirmationDialog
        confirmationDialog={confirmationDialog}
        onClose={() => setConfirmationDialog((current) => ({ ...current, open: false }))}
        onExited={() => setConfirmationDialog({ open: false, title: '', message: '' })}
      />
    </Box>
  );
}

export default Scheduling;
