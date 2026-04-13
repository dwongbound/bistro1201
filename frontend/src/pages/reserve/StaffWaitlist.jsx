import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import EditNoteIcon from '@mui/icons-material/EditNote';
import EmailIcon from '@mui/icons-material/Email';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  ClickAwayListener,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useEffect, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { createApiFetch } from '../../common/apiClient';
import { getApiUrl } from '../../common/appConfig';
import PageIntro from '../../common/PageIntro';
import SurfaceCard from '../../common/SurfaceCard';
import { useFormErrors } from '../../common/useFormErrors';
import {
  clearStaffAccessCode,
  readStaffAccessCode,
  saveStaffAccessCode,
} from '../../common/reserveAccessCookie';
import {
  contactWaitlistEntry,
  deleteWaitlistEntry,
  fetchWaitlist,
  reorderWaitlist,
  updateWaitlistNote,
} from './waitlistApi';

const PAGE_SIZE = 50;

function sanitizeWaitlistCodePart(value) {
  return value
    .toLowerCase()
    .split('')
    .map((char) => (/[a-z0-9]/.test(char) ? char : '_'))
    .join('');
}

function buildSuggestedWaitlistCode(entry) {
  return `${sanitizeWaitlistCodePart(entry.first_name)}_${sanitizeWaitlistCodePart(entry.last_name)}${entry.id.toString(16)}`;
}

function formatStaffNoteTimestamp(timestamp) {
  if (!timestamp) {
    return '';
  }

  const isoDate = new Date(timestamp);
  if (!Number.isNaN(isoDate.getTime())) {
    return isoDate.toLocaleString([], {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  const legacyMatch = timestamp.match(
    /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2}) (AM|PM)$/i,
  );
  if (!legacyMatch) {
    return timestamp;
  }

  const [, month, day, year, hourText, minute, second, meridiem] = legacyMatch;
  let hour = Number(hourText) % 12;
  if (meridiem.toUpperCase() === 'PM') {
    hour += 12;
  }

  const utcDate = new Date(Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    hour,
    Number(minute),
    Number(second),
  ));

  if (Number.isNaN(utcDate.getTime())) {
    return timestamp;
  }

  return utcDate.toLocaleString([], {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

function parseStaffNoteHistory(staffNote) {
  if (!staffNote?.trim()) {
    return [];
  }

  return staffNote
    .split(/\n\s*\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry, index) => {
      const separatorIndex = entry.lastIndexOf(' - ');
      if (separatorIndex === -1) {
        return { id: `${index}-${entry}`, text: entry, timestamp: '' };
      }

      return {
        id: `${index}-${entry}`,
        text: entry.slice(0, separatorIndex).trim(),
        timestamp: formatStaffNoteTimestamp(entry.slice(separatorIndex + 3).trim()),
      };
    });
}

/** Wraps a CSV cell value in quotes and escapes any internal quotes. */
function csvCell(value) {
  const str = value == null ? '' : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

/** Fetches every waitlist entry across all pages and triggers a CSV download. */
async function exportWaitlistCsv(apiFetch) {
  const allEntries = [];
  let offset = 0;
  let total = null;

  do {
    const response = await fetchWaitlist(apiFetch, offset, PAGE_SIZE);
    if (!response.ok) throw new Error('Failed to fetch waitlist for export');
    const data = await response.json();
    total = data.total;
    allEntries.push(...data.entries);
    offset += PAGE_SIZE;
  } while (allEntries.length < total);

  const headers = ['Position', 'First Name', 'Last Name', 'Email', 'Phone', 'Sign-up Date', 'Notes', 'Staff Note', 'Access Code Sent'];
  const rows = allEntries.map((entry, index) => [
    index + 1,
    entry.first_name,
    entry.last_name,
    entry.email,
    entry.phone,
    new Date(entry.created_at * 1000).toLocaleDateString(),
    entry.notes,
    entry.staff_note,
    entry.contacted_code || '',
  ].map(csvCell));

  const csv = [headers.map(csvCell).join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * One draggable waitlist row used inside the sortable list.
 */
function SortableWaitlistRow({ entry, position, onDelete, onContact, onNote, busy }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.id,
  });
  const [infoOpen, setInfoOpen] = useState(false);
  const canHoverDetails = useMediaQuery('(hover: hover) and (pointer: fine)');

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isContacted = Boolean(entry.contacted_code);
  const fullName = `${entry.first_name} ${entry.last_name}`;
  const joinedLabel = new Date(entry.created_at * 1000).toLocaleDateString();
  const detailRows = [
    { label: 'Email', value: entry.email },
    { label: 'Phone', value: entry.phone },
    { label: 'Joined', value: joinedLabel },
    { label: 'Guest note', value: entry.notes },
    { label: 'Staff note', value: entry.staff_note },
    { label: 'Access code', value: entry.contacted_code },
  ].filter((detail) => detail.value);

  return (
    <Box
      ref={setNodeRef}
      style={style}
      sx={{
        px: { xs: 1.5, sm: 2 },
        py: 1.5,
        borderBottom: '1px solid rgba(217, 195, 161, 0.12)',
        backgroundColor: isDragging ? 'rgba(217, 195, 161, 0.08)' : 'transparent',
        '&:last-child': { borderBottom: 'none' },
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
      >
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            variant="body2"
            sx={{
              color: 'text.disabled',
              fontVariantNumeric: 'tabular-nums',
              minWidth: 24,
              flexShrink: 0,
              textAlign: 'right',
            }}
          >
            {position}.
          </Typography>

          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Typography
                sx={{
                  fontWeight: 700,
                  fontSize: { xs: '1.05rem', sm: '1.1rem' },
                  lineHeight: 1.2,
                  overflowWrap: 'anywhere',
                }}
              >
                {fullName}
              </Typography>
              <ClickAwayListener onClickAway={() => setInfoOpen(false)}>
                <Tooltip
                  arrow
                  placement={canHoverDetails ? 'top' : 'bottom-start'}
                  open={infoOpen}
                  onOpen={() => {
                    if (canHoverDetails) setInfoOpen(true);
                  }}
                  onClose={() => setInfoOpen(false)}
                  disableHoverListener={!canHoverDetails}
                  disableFocusListener={!canHoverDetails}
                  disableTouchListener={canHoverDetails}
                  title={(
                    <Stack spacing={0.75} sx={{ py: 0.5, minWidth: 220, maxWidth: 320 }}>
                      {detailRows.map((detail) => (
                        <Box key={detail.label}>
                          <Typography
                            variant="caption"
                            sx={{ display: 'block', color: 'rgba(255,255,255,0.62)', letterSpacing: '0.06em', textTransform: 'uppercase' }}
                          >
                            {detail.label}
                          </Typography>
                          <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                            {detail.value}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  )}
                  slotProps={{
                    tooltip: {
                      sx: {
                        backgroundColor: 'rgba(26, 21, 18, 0.98)',
                        border: '1px solid rgba(217, 195, 161, 0.18)',
                        boxShadow: '0 18px 48px rgba(0,0,0,0.35)',
                        borderRadius: 2,
                        p: 1.25,
                      },
                    },
                  }}
                >
                  <IconButton
                    size="small"
                    onClick={() => setInfoOpen((open) => !open)}
                    aria-label={`View details for ${fullName}`}
                    sx={{
                      width: 28,
                      height: 28,
                      color: infoOpen ? 'secondary.main' : 'text.secondary',
                      backgroundColor: infoOpen ? 'rgba(217, 195, 161, 0.1)' : 'transparent',
                      '&:hover': {
                        backgroundColor: 'rgba(217, 195, 161, 0.08)',
                      },
                    }}
                  >
                    <HelpOutlineIcon sx={{ fontSize: 17 }} />
                  </IconButton>
                </Tooltip>
              </ClickAwayListener>
              {isContacted && (
                <Chip label="Contacted" size="small" color="success" variant="outlined" />
              )}
            </Stack>
          </Box>
        </Stack>

        <Stack direction="row" spacing={0.25} justifyContent="flex-end" flexShrink={0} alignItems="center">
          <Tooltip title={isContacted ? 'Resend access code' : 'Send access code'}>
            <span>
              <IconButton
                size="small"
                onClick={() => onContact(entry)}
                disabled={busy}
                aria-label={`Send access code to ${fullName}`}
                sx={{
                  width: 32,
                  height: 32,
                  border: '1px solid rgba(217, 195, 161, 0.16)',
                  backgroundColor: 'rgba(217, 195, 161, 0.04)',
                }}
              >
                <EmailIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Add / edit note">
            <span>
              <IconButton
                size="small"
                onClick={() => onNote(entry)}
                disabled={busy}
                aria-label={`Edit note for ${fullName}`}
                sx={{
                  width: 32,
                  height: 32,
                  border: '1px solid rgba(217, 195, 161, 0.16)',
                  backgroundColor: 'rgba(217, 195, 161, 0.04)',
                }}
              >
                <EditNoteIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Delete">
            <span>
              <IconButton
                size="small"
                color="error"
                onClick={() => onDelete(entry)}
                disabled={busy}
                aria-label={`Delete ${fullName}`}
                sx={{
                  width: 32,
                  height: 32,
                  border: '1px solid rgba(217, 195, 161, 0.16)',
                  backgroundColor: 'rgba(217, 195, 161, 0.04)',
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>

        <Box
          {...attributes}
          {...listeners}
          sx={{
            cursor: 'grab',
            color: 'text.disabled',
            flexShrink: 0,
            width: 32,
            height: 32,
            display: 'grid',
            placeItems: 'center',
            borderRadius: '999px',
            '&:hover': { color: 'text.secondary' },
          }}
          aria-label={`Drag ${fullName} to reorder`}
        >
          <DragIndicatorIcon fontSize="small" />
        </Box>
      </Stack>
    </Box>
  );
}

/**
 * Staff-only page showing the full waitlist with management controls.
 * Protected by a staff access code gate identical to StaffGallery.
 */
function StaffWaitlist() {
  const apiUrl = getApiUrl();

  const [staffCode, setStaffCode] = useState('');
  const [auth, setAuth] = useState({ token: '', role: '' });
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [cookieChecked, setCookieChecked] = useState(false);

  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  // Manual entry form
  const [addForm, setAddForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', notes: '',
  });
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState('');

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Contact confirmation dialog
  const [contactTarget, setContactTarget] = useState(null);
  const [contactCode, setContactCode] = useState('');
  const [contactResult, setContactResult] = useState(null);

  // Note dialog
  const [noteTarget, setNoteTarget] = useState(null);
  const [noteText, setNoteText] = useState('');
  const authFormErrors = useFormErrors();
  const addFormErrors = useFormErrors();

  const apiFetch = createApiFetch({
    apiUrl,
    getToken: () => auth.token,
    getServiceKey: () => readStaffAccessCode(),
    onUnauthorized: () => {
      setAuth({ token: '', role: '' });
      setAuthError('Your session has expired. Please sign in again.');
      setCookieChecked(false);
    },
  });

  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // --- Auth ---

  const login = async (code, { showErrors = true, persist = false } = {}) => {
    const trimmed = code.trim();
    if (!trimmed) return false;

    setAuthBusy(true);
    try {
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      });

      if (!response.ok) {
        if (showErrors) {
          const payload = await response.json().catch(() => ({}));
          setAuthError(payload.error || 'Invalid access code.');
        }
        return false;
      }

      const payload = await response.json();
      if (payload.role !== 'staff') {
        if (showErrors) setAuthError('Staff access required.');
        return false;
      }

      setAuth(payload);
      if (persist) saveStaffAccessCode(trimmed);
      setAuthError('');
      return true;
    } catch {
      if (showErrors) setAuthError('Unable to sign in right now.');
      return false;
    } finally {
      setAuthBusy(false);
    }
  };

  // Auto-login from cookie on mount.
  useEffect(() => {
    if (auth.token || cookieChecked) return;

    const remembered = readStaffAccessCode();
    if (!remembered) {
      setCookieChecked(true);
      return;
    }

    login(remembered, { showErrors: false, persist: true }).then((ok) => {
      if (!ok) clearStaffAccessCode();
      setCookieChecked(true);
    });
  }, [auth.token, cookieChecked]);

  const handleExport = async () => {
    setExportBusy(true);
    try {
      await exportWaitlistCsv(apiFetch);
    } catch {
      setStatus({ type: 'error', message: 'Unable to export the waitlist right now.' });
    } finally {
      setExportBusy(false);
    }
  };

  // --- Data loading ---

  const loadPage = async (nextOffset = 0, replace = true) => {
    setLoading(true);
    try {
      const response = await fetchWaitlist(apiFetch, nextOffset, PAGE_SIZE);
      if (!response.ok) throw new Error('Failed to load waitlist');
      const data = await response.json();
      setTotal(data.total);
      setEntries((current) => (replace ? data.entries : [...current, ...data.entries]));
      setOffset(nextOffset);
    } catch {
      setStatus({ type: 'error', message: 'Unable to load the waitlist right now.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!auth.token) return;
    loadPage(0, true);
  }, [auth.token]);

  // --- Delete ---

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      const response = await deleteWaitlistEntry(apiFetch, deleteTarget.id);
      if (!response.ok) throw new Error();
      setEntries((current) => current.filter((e) => e.id !== deleteTarget.id));
      setTotal((t) => t - 1);
      setStatus({ type: 'success', message: `${deleteTarget.first_name} ${deleteTarget.last_name} has been removed from the waitlist.` });
    } catch {
      setStatus({ type: 'error', message: 'Unable to delete the waitlist entry right now.' });
    } finally {
      setBusy(false);
      setDeleteTarget(null);
    }
  };

  // --- Contact ---

  const handleContactConfirm = async () => {
    if (!contactTarget) return;
    setBusy(true);
    try {
      const response = await contactWaitlistEntry(apiFetch, contactTarget.id, contactCode.trim());
      if (!response.ok) throw new Error();
      const data = await response.json();
      setEntries((current) => current.map((e) => (e.id === data.entry.id ? data.entry : e)));
      setContactResult(data);
      setContactTarget(null);
      setContactCode('');
    } catch {
      setStatus({ type: 'error', message: 'Unable to send the access code right now.' });
      setContactTarget(null);
      setContactCode('');
    } finally {
      setBusy(false);
    }
  };

  // --- Note ---

  const handleNoteOpen = (entry) => {
    setNoteTarget(entry);
    setNoteText('');
  };

  const handleNoteSave = async () => {
    if (!noteTarget) return;
    setBusy(true);
    try {
      const response = await updateWaitlistNote(apiFetch, noteTarget.id, noteText);
      if (!response.ok) throw new Error();
      const updated = await response.json();
      setEntries((current) => current.map((e) => (e.id === updated.id ? updated : e)));
    } catch {
      setStatus({ type: 'error', message: 'Unable to save the note right now.' });
    } finally {
      setBusy(false);
      setNoteTarget(null);
    }
  };

  // --- Reorder ---

  const handleDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const reordered = arrayMove(
      entries,
      entries.findIndex((e) => e.id === active.id),
      entries.findIndex((e) => e.id === over.id),
    );
    setEntries(reordered);
    try {
      await reorderWaitlist(apiFetch, reordered.map((e) => e.id));
    } catch {
      // Revert on failure
      loadPage(0, true);
    }
  };

  // --- Manual entry ---

  const handleAddChange = (event) => {
    const { name, value } = event.target;
    addFormErrors.clearError(name);
    setAddForm((f) => ({ ...f, [name]: value }));
  };

  const handleAuthSubmit = (event) => {
    event.preventDefault();
    if (!authFormErrors.validate({ staff_access_code: staffCode })) {
      setAuthError('Please fill in the required fields.');
      return;
    }
    login(staffCode, { showErrors: true, persist: true });
  };

  const handleAddSubmit = async (event) => {
    event.preventDefault();
    if (!addFormErrors.validate({
      first_name: addForm.first_name,
      last_name: addForm.last_name,
      email: addForm.email,
      phone: addForm.phone,
    })) {
      setAddError('Please fill in the required fields.');
      return;
    }
    setAddBusy(true);
    setAddError('');
    try {
      const response = await fetch(`${apiUrl}/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: addForm.first_name.trim(),
          last_name: addForm.last_name.trim(),
          email: addForm.email.trim(),
          phone: addForm.phone.trim(),
          notes: addForm.notes.trim() || null,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setAddError(payload.error || 'Unable to add entry.');
        return;
      }
      const entry = await response.json();
      setEntries((current) => [...current, entry]);
      setTotal((t) => t + 1);
      setAddForm({ first_name: '', last_name: '', email: '', phone: '', notes: '' });
      addFormErrors.clearAll();
      setStatus({ type: 'success', message: `${entry.first_name} ${entry.last_name} has been added to the waitlist.` });
    } catch {
      setAddError('Unable to add entry right now.');
    } finally {
      setAddBusy(false);
    }
  };

  // --- Auth gate ---

  if (!auth.token) {
    return (
      <Box sx={{ maxWidth: 480, mx: 'auto', mt: 8, px: 2 }}>
        <SurfaceCard contentSx={{ p: { xs: 3, sm: 4 } }}>
          <Stack component="form" onSubmit={handleAuthSubmit} spacing={3} noValidate>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Waitlist Admin
            </Typography>
            <TextField
              type="password"
              label="Staff Access Code"
              value={staffCode}
              onChange={(e) => {
                authFormErrors.clearError('staff_access_code');
                setStaffCode(e.target.value);
              }}
              error={Boolean(authFormErrors.errors.staff_access_code)}
              helperText={authFormErrors.errors.staff_access_code}
              fullWidth
            />
            <Button type="submit" variant="contained" disabled={authBusy}>
              Sign In
            </Button>
            {authError && <Alert severity="error">{authError}</Alert>}
          </Stack>
        </SurfaceCard>
      </Box>
    );
  }

  const hasMore = entries.length < total;
  const noteHistory = parseStaffNoteHistory(noteTarget?.staff_note || '');

  return (
    <Box sx={{ display: 'grid', gap: 4 }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" gap={2}>
        <PageIntro
          eyebrow="Staff"
          title="Waitlist"
          description={"Waitlist can be reordered, you can add an internal staff note, and you can delete as well."}
        />
        <Button
          variant="outlined"
          size="small"
          startIcon={<DownloadIcon />}
          onClick={handleExport}
          disabled={exportBusy || total === 0}
        >
          {exportBusy ? 'Exporting…' : 'Export CSV'}
        </Button>
      </Stack>

      {status.message && (
        <Alert severity={status.type === 'error' ? 'error' : 'success'} onClose={() => setStatus({ type: '', message: '' })}>
          {status.message}
        </Alert>
      )}

      {/* Waitlist table */}
      <SurfaceCard>
        {loading && entries.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <CircularProgress size={28} />
          </Box>
        ) : entries.length === 0 ? (
          <Box sx={{ p: 4 }}>
            <Typography color="text.secondary">The waitlist is empty.</Typography>
          </Box>
        ) : (
          <>
            {/* Column header */}
            <Box
              sx={{
                px: 2,
                py: 1,
                borderBottom: '1px solid rgba(217, 195, 161, 0.18)',
                backgroundColor: 'rgba(217, 195, 161, 0.08)',
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.08em' }}>
                Waitlist ({total})
              </Typography>
            </Box>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={entries.map((e) => e.id)} strategy={verticalListSortingStrategy}>
                {entries.map((entry, index) => (
                  <SortableWaitlistRow
                    key={entry.id}
                    entry={entry}
                    position={index + 1}
                    busy={busy}
                    onDelete={setDeleteTarget}
                    onContact={(entry) => {
                      setContactTarget(entry);
                      setContactCode(entry.contacted_code || buildSuggestedWaitlistCode(entry));
                    }}
                    onNote={handleNoteOpen}
                  />
                ))}
              </SortableContext>
            </DndContext>

            {hasMore && (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <Button
                  variant="text"
                  onClick={() => loadPage(offset + PAGE_SIZE, false)}
                  disabled={loading}
                >
                  {loading ? 'Loading…' : `Load more (${total - entries.length} remaining)`}
                </Button>
              </Box>
            )}
          </>
        )}
      </SurfaceCard>

      {/* Manual entry form */}
      <SurfaceCard>
        <Box sx={{ px: 2, py: 1, borderBottom: '1px solid rgba(217, 195, 161, 0.18)', backgroundColor: 'rgba(217, 195, 161, 0.08)' }}>
          <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.08em' }}>
            Add Entry Manually
          </Typography>
        </Box>
        <Box sx={{ p: 2 }}>
          <Stack component="form" onSubmit={handleAddSubmit} spacing={2} noValidate>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <TextField label="First Name" name="first_name" value={addForm.first_name} onChange={handleAddChange} error={Boolean(addFormErrors.errors.first_name)} helperText={addFormErrors.errors.first_name} size="small" />
              <TextField label="Last Name" name="last_name" value={addForm.last_name} onChange={handleAddChange} error={Boolean(addFormErrors.errors.last_name)} helperText={addFormErrors.errors.last_name} size="small" />
              <TextField label="Email" name="email" type="email" value={addForm.email} onChange={handleAddChange} error={Boolean(addFormErrors.errors.email)} helperText={addFormErrors.errors.email} size="small" />
              <TextField label="Phone" name="phone" type="tel" value={addForm.phone} onChange={handleAddChange} error={Boolean(addFormErrors.errors.phone)} helperText={addFormErrors.errors.phone} size="small" />
            </Box>
            <TextField
              label="Notes"
              name="notes"
              value={addForm.notes}
              onChange={handleAddChange}
              multiline
              rows={2}
              size="small"
            />
            {addError && <Alert severity="error">{addError}</Alert>}
            <Box>
              <Button type="submit" variant="contained" disabled={addBusy}>
                Add to Waitlist
              </Button>
            </Box>
          </Stack>
        </Box>
      </SurfaceCard>

      {/* Delete confirmation dialog */}
      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Remove from Waitlist</DialogTitle>
        <DialogContent>
          <Typography>
            Remove{' '}
            <strong>
              {deleteTarget?.first_name} {deleteTarget?.last_name}
            </strong>{' '}
            from the waitlist? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={busy}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" disabled={busy} variant="contained">
            Remove
          </Button>
        </DialogActions>
      </Dialog>

      {/* Contact confirmation dialog */}
      <Dialog open={Boolean(contactTarget)} onClose={() => { setContactTarget(null); setContactCode(''); }} maxWidth="xs" fullWidth>
        <DialogTitle>Send Access Code</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography>
              Send a temporary 3-day access code to{' '}
              <strong>
                {contactTarget?.first_name} {contactTarget?.last_name}
              </strong>
              {' '}at <strong>{contactTarget?.email}</strong>?
            </Typography>
            <TextField
              label="Access Code"
              value={contactCode}
              onChange={(event) => setContactCode(event.target.value)}
              fullWidth
              autoFocus
              helperText="You can customize the suggested code before sending it."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setContactTarget(null); setContactCode(''); }} disabled={busy}>Cancel</Button>
          <Button onClick={handleContactConfirm} variant="contained" disabled={busy || !contactCode.trim()}>
            Send Code
          </Button>
        </DialogActions>
      </Dialog>

      {/* Contact result dialog */}
      <Dialog open={Boolean(contactResult)} onClose={() => setContactResult(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Access Code Sent</DialogTitle>
        <DialogContent>
          <Stack spacing={1}>
            <Typography>
              Code <strong>{contactResult?.code}</strong> has been created
              {contactResult?.email_sent ? ' and the email has been sent.' : '. No email was sent because email is not configured.'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Valid until:{' '}
              {contactResult?.expires_at
                ? new Date(contactResult.expires_at * 1000).toLocaleString()
                : '—'}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setContactResult(null)} variant="contained">Done</Button>
        </DialogActions>
      </Dialog>

      {/* Note dialog */}
      <Dialog open={Boolean(noteTarget)} onClose={() => setNoteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          Staff Note — {noteTarget?.first_name} {noteTarget?.last_name}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {noteTarget?.staff_note ? (
              <Box
                sx={{
                  p: 1.25,
                  borderRadius: 2,
                  border: '1px solid rgba(217, 195, 161, 0.14)',
                  backgroundColor: 'rgba(217, 195, 161, 0.04)',
                  maxHeight: 260,
                  overflowY: 'auto',
                }}
              >
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                  Note History
                </Typography>
                <Stack spacing={1}>
                  {noteHistory.map((entry) => (
                    <Box
                      key={entry.id}
                      sx={{
                        p: 1.25,
                        borderRadius: 1.5,
                        backgroundColor: 'rgba(217, 195, 161, 0.12)',
                        border: '1px solid rgba(217, 195, 161, 0.12)',
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                      >
                        {entry.text}
                      </Typography>
                      {entry.timestamp ? (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block', mt: 0.75 }}
                        >
                          {entry.timestamp}
                        </Typography>
                      ) : null}
                    </Box>
                  ))}
                </Stack>
              </Box>
            ) : null}
            <TextField
              label="Add Note"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              multiline
              rows={3}
              fullWidth
              autoFocus
              helperText="Each saved note is appended to the history with a timestamp."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNoteTarget(null)} disabled={busy}>Cancel</Button>
          <Button onClick={handleNoteSave} variant="contained" disabled={busy || !noteText.trim()}>Save Note</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default StaffWaitlist;
