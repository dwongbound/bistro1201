import { Dialog } from '@mui/material';

/**
 * Confirms reservations and staff actions without leaving the reserve dashboard.
 * MUI's Dialog is kept for its focus trap and exit callback; the inside is Tailwind.
 */
function ReservationConfirmationDialog({ confirmationDialog, onClose, onExited }) {
  return (
    <Dialog
      open={confirmationDialog.open}
      onClose={onClose}
      aria-labelledby="confirmation-dialog-title"
      slotProps={{
        transition: {
          onExited,
        },
        paper: {
          className: 'm-4! w-full! max-w-md! rounded-3xl! border! border-line-strong! bg-ink-900! shadow-2xl! shadow-black/60!',
        },
        backdrop: {
          className: 'bg-ink-950/70! backdrop-blur-sm',
        },
      }}
    >
      <div className="grid justify-items-center gap-5 px-6 pt-8 pb-6 text-center sm:px-8">
        <span className="confirm-pop grid size-16 place-items-center rounded-full bg-gradient-to-br from-sand-light to-brass text-ink-950 shadow-lg shadow-brass/30">
          <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path className="confirm-check" d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
        <h2 id="confirmation-dialog-title" className="font-display text-2xl tracking-tight text-cream">
          {confirmationDialog.title || 'Reservation Confirmed'}
        </h2>
        <p className="leading-relaxed text-muted">{confirmationDialog.message}</p>
        <button type="button" onClick={onClose} className="btn btn-primary mt-2 w-full">
          Close
        </button>
      </div>
    </Dialog>
  );
}

export default ReservationConfirmationDialog;
