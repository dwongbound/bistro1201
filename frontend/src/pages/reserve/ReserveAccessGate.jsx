import FormField from '../../common/FormField';
import Notice from '../../common/Notice';
import { ButtonSpinner } from '../../common/Spinner';
import { useFormErrors } from '../../common/useFormErrors';

/**
 * Renders the access-code form shown before a reserve session is created.
 */
function ReserveAccessGate({ accessCode, authBusy, authStatus, onAccessCodeChange, onSubmit }) {
  const { errors, validate, clearError } = useFormErrors();

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!validate({ access_code: accessCode })) {
      return;
    }
    onSubmit(event);
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="panel grid content-start gap-6 border-sand/25">
      <div className="grid gap-2">
        <p className="eyebrow">Have a code?</p>
        <h2 className="font-display text-2xl tracking-tight sm:text-3xl">Reserve Access</h2>
        <p className="leading-relaxed text-muted">Your code unlocks the calendar of open nights.</p>
      </div>
      <FormField
        type="password"
        label="Access Code"
        name="access_code"
        autoComplete="off"
        value={accessCode}
        onChange={(event) => {
          clearError('access_code');
          onAccessCodeChange(event);
        }}
        placeholder="Access Code"
        invalid={Boolean(errors.access_code)}
      />
      <button type="submit" disabled={authBusy} className="btn btn-primary w-full">
        {authBusy ? <ButtonSpinner /> : null}
        Submit
      </button>
      {authStatus.message ? (
        <Notice tone={authStatus.type === 'error' ? 'error' : 'success'}>{authStatus.message}</Notice>
      ) : null}
    </form>
  );
}

export default ReserveAccessGate;
