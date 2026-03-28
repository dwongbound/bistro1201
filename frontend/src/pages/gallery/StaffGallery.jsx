import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import CollectionsRoundedIcon from '@mui/icons-material/CollectionsRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { createApiFetch } from '../../common/apiClient';
import { getApiUrl, getR2BaseUrl } from '../../common/appConfig';
import PageIntro from '../../common/PageIntro';
import SurfaceCard from '../../common/SurfaceCard';
import { fetchGalleryEvents } from './galleryApi';
import {
  addGalleryImage,
  createGalleryEvent,
  deleteGalleryEvent,
  deleteGalleryImage,
  fetchAdminEventImages,
} from './galleryAdminApi';

const GALLERY_STAFF_COOKIE = 'bistro_gallery_staff_code';
const COOKIE_PATH = 'Path=/';
const COOKIE_SAME_SITE = 'SameSite=Lax';

function saveGalleryStaffCode(code) {
  document.cookie = [`${GALLERY_STAFF_COOKIE}=${encodeURIComponent(code)}`, COOKIE_PATH, `Max-Age=${60 * 60 * 24 * 30}`, COOKIE_SAME_SITE].join('; ');
}

function readGalleryStaffCode() {
  const entry = document.cookie.split('; ').find((c) => c.startsWith(`${GALLERY_STAFF_COOKIE}=`));
  return entry ? decodeURIComponent(entry.slice(`${GALLERY_STAFF_COOKIE}=`.length)) : '';
}

function clearGalleryStaffCode() {
  document.cookie = [`${GALLERY_STAFF_COOKIE}=`, COOKIE_PATH, 'Max-Age=0', 'Expires=Thu, 01 Jan 1970 00:00:00 GMT', COOKIE_SAME_SITE].join('; ');
}

const EVENT_TYPES = ['Event', 'Private Dinner', 'Holiday Special', 'Tasting Menu', 'Guest Chef'];

const emptyEventForm = { slug: '', title: '', date_label: '', summary: '', event_type: 'Event', cover_image_url: '', sort_order: '' };
const emptyImageForm = { image_url: '', alt_text: '', sort_order: '', is_preview: false };

/**
 * Hidden staff-only page at /staff/gallery for managing gallery events and images.
 * Not linked in the nav — access by direct URL only.
 */
function StaffGallery() {
  const apiUrl = getApiUrl();
  const r2BaseUrl = getR2BaseUrl();

  const [accessCode, setAccessCode] = useState('');
  const [auth, setAuth] = useState({ token: '', role: '' });
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');

  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [eventsError, setEventsError] = useState('');

  const [selectedSlug, setSelectedSlug] = useState(null);
  const [eventImages, setEventImages] = useState([]);
  const [loadingImages, setLoadingImages] = useState(false);

  const [eventForm, setEventForm] = useState(emptyEventForm);
  const [eventFormBusy, setEventFormBusy] = useState(false);
  const [eventFormError, setEventFormError] = useState('');

  const [imageForm, setImageForm] = useState(emptyImageForm);
  const [imageFormBusy, setImageFormBusy] = useState(false);
  const [imageFormError, setImageFormError] = useState('');

  const [deleteEventDialog, setDeleteEventDialog] = useState(null);
  const [deleteImageDialog, setDeleteImageDialog] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const clearAuth = () => {
    setAuth({ token: '', role: '' });
    clearGalleryStaffCode();
  };

  const apiFetch = createApiFetch({
    apiUrl,
    getToken: () => auth.token,
    onUnauthorized: clearAuth,
  });

  const loadEvents = async () => {
    setLoadingEvents(true);
    setEventsError('');
    try {
      const data = await fetchGalleryEvents();
      setEvents(data);
    } catch (error) {
      setEventsError(error.message || 'Unable to load gallery events.');
    } finally {
      setLoadingEvents(false);
    }
  };

  const loadImages = async (slug) => {
    setLoadingImages(true);
    setEventImages([]);
    try {
      const images = await fetchAdminEventImages(slug);
      setEventImages(images);
    } catch {
      setEventImages([]);
    } finally {
      setLoadingImages(false);
    }
  };

  const tryLogin = async (code) => {
    if (!code) return;
    setAuthBusy(true);
    setAuthError('');
    try {
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Invalid access code.');
      if (payload.role !== 'staff') throw new Error('This page requires a staff access code.');
      setAuth({ token: payload.token, role: payload.role });
      saveGalleryStaffCode(code);
    } catch (error) {
      setAuthError(error.message);
      clearGalleryStaffCode();
    } finally {
      setAuthBusy(false);
    }
  };

  // Silent re-auth on mount from cookie
  useEffect(() => {
    const saved = readGalleryStaffCode();
    if (saved) tryLogin(saved);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load events once authenticated
  useEffect(() => {
    if (auth.token) loadEvents();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.token]);

  // Load images when an event is selected
  useEffect(() => {
    if (selectedSlug) loadImages(selectedSlug);
  }, [selectedSlug]);

  const handleLogin = (event) => {
    event.preventDefault();
    tryLogin(accessCode);
  };

  const handleCreateEvent = async (event) => {
    event.preventDefault();
    setEventFormBusy(true);
    setEventFormError('');
    try {
      await createGalleryEvent(apiFetch, {
        ...eventForm,
        sort_order: eventForm.sort_order !== '' ? Number(eventForm.sort_order) : 0,
      });
      setEventForm(emptyEventForm);
      await loadEvents();
    } catch (error) {
      setEventFormError(error.message);
    } finally {
      setEventFormBusy(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!deleteEventDialog) return;
    setDeleteBusy(true);
    try {
      await deleteGalleryEvent(apiFetch, deleteEventDialog.slug);
      setDeleteEventDialog(null);
      if (selectedSlug === deleteEventDialog.slug) setSelectedSlug(null);
      await loadEvents();
    } catch (error) {
      setEventsError(error.message);
      setDeleteEventDialog(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleAddImage = async (event) => {
    event.preventDefault();
    if (!selectedSlug) return;
    setImageFormBusy(true);
    setImageFormError('');
    try {
      await addGalleryImage(apiFetch, selectedSlug, {
        ...imageForm,
        sort_order: imageForm.sort_order !== '' ? Number(imageForm.sort_order) : 0,
      });
      setImageForm(emptyImageForm);
      await loadImages(selectedSlug);
    } catch (error) {
      setImageFormError(error.message);
    } finally {
      setImageFormBusy(false);
    }
  };

  const handleDeleteImage = async () => {
    if (!deleteImageDialog || !selectedSlug) return;
    setDeleteBusy(true);
    try {
      await deleteGalleryImage(apiFetch, selectedSlug, deleteImageDialog.id);
      setDeleteImageDialog(null);
      await loadImages(selectedSlug);
    } catch (error) {
      setImageFormError(error.message);
      setDeleteImageDialog(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  // — Login gate —
  if (!auth.token) {
    return (
      <Box sx={{ display: 'grid', gap: 4 }}>
        <Grid container spacing={4} alignItems="stretch">
          <Grid size={{ xs: 12, md: 6 }}>
            <SurfaceCard
              cardSx={{ minHeight: '100%', background: 'linear-gradient(145deg, rgba(36,28,22,0.98), rgba(56,44,34,0.95))' }}
              contentSx={{ p: { xs: 3, sm: 4 } }}
            >
              <Stack spacing={2}>
                <Chip icon={<LockRoundedIcon />} label="Staff Access Only" sx={{ width: 'fit-content' }} variant="outlined" />
                <Typography variant="h3" sx={{ fontWeight: 800 }}>Gallery Admin</Typography>
                <Typography color="text.secondary" sx={{ lineHeight: 1.8 }}>
                  Manage gallery events and photos. Staff access code required.
                  This page is not linked from the public site.
                </Typography>
              </Stack>
            </SurfaceCard>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <SurfaceCard cardSx={{ minHeight: '100%' }} contentSx={{ p: { xs: 3, sm: 4 } }}>
              <Stack component="form" onSubmit={handleLogin} spacing={3}>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>Staff Login</Typography>
                <TextField
                  type="password"
                  label="Staff Access Code"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  required
                  fullWidth
                />
                <Button type="submit" variant="contained" size="large" disabled={authBusy}>
                  {authBusy ? <CircularProgress size={22} color="inherit" /> : 'Sign In'}
                </Button>
                {authError ? <Alert severity="error">{authError}</Alert> : null}
              </Stack>
            </SurfaceCard>
          </Grid>
        </Grid>
      </Box>
    );
  }

  // — Authenticated view —
  const selectedEvent = events.find((e) => e.slug === selectedSlug) || null;

  return (
    <Box sx={{ display: 'grid', gap: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2}>
        <PageIntro
          eyebrow="Staff only"
          title="Gallery Admin"
          description="This page is hidden and used for updating the gallery pictures."
        />
        <Button
          variant="outlined"
          startIcon={<LogoutRoundedIcon />}
          onClick={clearAuth}
          sx={{ alignSelf: 'flex-start', mt: { xs: 0, sm: 1 } }}
        >
          Sign Out
        </Button>
      </Stack>

      <Grid container spacing={3} alignItems="flex-start">

        {/* Left — event list + create form */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Stack spacing={3}>

            {/* Event list */}
            <SurfaceCard contentSx={{ p: { xs: 2, sm: 2.5 } }}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                <CollectionsRoundedIcon color="secondary" />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Events</Typography>
              </Stack>
              {eventsError ? <Alert severity="error" sx={{ mb: 1 }}>{eventsError}</Alert> : null}
              {loadingEvents ? (
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 3 }}>
                  <CircularProgress size={18} />
                  <Typography color="text.secondary">Loading events...</Typography>
                </Stack>
              ) : events.length === 0 ? (
                <Typography color="text.secondary">No events yet.</Typography>
              ) : (
                <Stack divider={<Divider />}>
                  {events.map((event) => (
                    <Stack
                      key={event.slug}
                      data-testid="event-row"
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      spacing={1}
                      sx={{
                        py: 1.25,
                        px: 0.5,
                        borderRadius: 1,
                        cursor: 'pointer',
                        backgroundColor: selectedSlug === event.slug ? 'rgba(176, 122, 68, 0.12)' : 'transparent',
                        '&:hover': { backgroundColor: 'rgba(255,255,255,0.04)' },
                      }}
                      onClick={() => setSelectedSlug(event.slug === selectedSlug ? null : event.slug)}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 600, fontSize: '0.95rem' }} noWrap>{event.title}</Typography>
                        <Typography variant="caption" color="text.secondary">{event.dateLabel} · {event.slug}</Typography>
                      </Box>
                      <Tooltip title="Delete event">
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); setDeleteEventDialog(event); }}
                          sx={{ color: 'text.secondary', flexShrink: 0 }}
                        >
                          <DeleteRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  ))}
                </Stack>
              )}
            </SurfaceCard>

            {/* Create event form */}
            <SurfaceCard contentSx={{ p: { xs: 2, sm: 2.5 } }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>New Event</Typography>
              <Stack component="form" onSubmit={handleCreateEvent} spacing={2}>
                <TextField label="Slug *" value={eventForm.slug} onChange={(e) => setEventForm((f) => ({ ...f, slug: e.target.value }))} required fullWidth size="small" placeholder="spring-supper-2026" />
                <TextField label="Title *" value={eventForm.title} onChange={(e) => setEventForm((f) => ({ ...f, title: e.target.value }))} required fullWidth size="small" />
                <TextField label="Date Label *" value={eventForm.date_label} onChange={(e) => setEventForm((f) => ({ ...f, date_label: e.target.value }))} required fullWidth size="small" placeholder="April 2026" />
                <TextField
                  select
                  label="Event Type"
                  value={eventForm.event_type}
                  onChange={(e) => setEventForm((f) => ({ ...f, event_type: e.target.value }))}
                  fullWidth
                  size="small"
                >
                  {EVENT_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>{type}</MenuItem>
                  ))}
                </TextField>
                <TextField label="Summary *" value={eventForm.summary} onChange={(e) => setEventForm((f) => ({ ...f, summary: e.target.value }))} required fullWidth size="small" multiline rows={2} />
                <TextField
                  label="Cover Image File *"
                  value={eventForm.cover_image_url}
                  onChange={(e) => setEventForm((f) => ({ ...f, cover_image_url: e.target.value }))}
                  required
                  fullWidth
                  size="small"
                  placeholder="cover.jpg"
                  helperText={r2BaseUrl && eventForm.slug ? `File location: ${r2BaseUrl.replace(/\/+$/, '')}/${eventForm.slug.replace(/^\/+|\/+$/g, '')}/<file>` : 'Enter just the file name or trailing path under this event slug.'}
                />
                <TextField label="Sort Order" value={eventForm.sort_order} onChange={(e) => setEventForm((f) => ({ ...f, sort_order: e.target.value }))} fullWidth size="small" type="number" />
                {eventFormError ? <Alert severity="error">{eventFormError}</Alert> : null}
                <Button type="submit" variant="contained" disabled={eventFormBusy}>
                  {eventFormBusy ? <CircularProgress size={20} color="inherit" /> : 'Create Event'}
                </Button>
              </Stack>
            </SurfaceCard>
          </Stack>
        </Grid>

        {/* Right — image management for selected event */}
        <Grid size={{ xs: 12, md: 7 }}>
          {!selectedEvent ? (
            <SurfaceCard contentSx={{ p: { xs: 2.5, sm: 3 } }}>
              <Typography color="text.secondary">Select an event from the list to manage its images.</Typography>
            </SurfaceCard>
          ) : (
            <Stack spacing={3}>
              <SurfaceCard contentSx={{ p: { xs: 2, sm: 2.5 } }}>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                  <AddPhotoAlternateRoundedIcon color="secondary" />
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>{selectedEvent.title}</Typography>
                    <Typography variant="caption" color="text.secondary">{selectedEvent.slug}</Typography>
                  </Box>
                </Stack>

                {/* Image list */}
                {loadingImages ? (
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 2 }}>
                    <CircularProgress size={18} />
                    <Typography color="text.secondary">Loading images...</Typography>
                  </Stack>
                ) : eventImages.length === 0 ? (
                  <Typography color="text.secondary" sx={{ mb: 2 }}>No images yet.</Typography>
                ) : (
                  <Stack divider={<Divider />} sx={{ mb: 2 }}>
                    {eventImages.map((image) => (
                      <Stack
                        key={`${image.id}-${image.imageUrl}`}
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        spacing={1}
                        sx={{ py: 1 }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontSize: '0.85rem', wordBreak: 'break-all' }}>{image.imageUrl}</Typography>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="caption" color="text.secondary">{image.altText}</Typography>
                            {image.isPreview ? <Chip label="preview" size="small" color="secondary" sx={{ height: 18, fontSize: '0.7rem' }} /> : null}
                          </Stack>
                        </Box>
                        <Tooltip title="Delete image">
                          <IconButton
                            size="small"
                            onClick={() => setDeleteImageDialog(image)}
                            sx={{ color: 'text.secondary', flexShrink: 0 }}
                          >
                            <DeleteRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    ))}
                  </Stack>
                )}

                {/* Add image form */}
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>Add Image</Typography>
                <Stack component="form" onSubmit={handleAddImage} spacing={2}>
                  <TextField
                    label="Image File *"
                    value={imageForm.image_url}
                    onChange={(e) => setImageForm((f) => ({ ...f, image_url: e.target.value }))}
                    required
                    fullWidth
                    size="small"
                    placeholder="plated-course-1.jpg"
                    helperText={r2BaseUrl ? `Saved as: ${r2BaseUrl.replace(/\/+$/, '')}/${selectedEvent.slug.replace(/^\/+|\/+$/g, '')}/<file>` : 'Enter just the file name or trailing path under this event slug.'}
                  />
                  <TextField label="Alt Text *" value={imageForm.alt_text} onChange={(e) => setImageForm((f) => ({ ...f, alt_text: e.target.value }))} required fullWidth size="small" />
                  <TextField label="Sort Order" value={imageForm.sort_order} onChange={(e) => setImageForm((f) => ({ ...f, sort_order: e.target.value }))} fullWidth size="small" type="number" />
                  <FormControlLabel
                    control={<Checkbox checked={imageForm.is_preview} onChange={(e) => setImageForm((f) => ({ ...f, is_preview: e.target.checked }))} color="secondary" />}
                    label="Show as preview on gallery index"
                  />
                  {imageFormError ? <Alert severity="error">{imageFormError}</Alert> : null}
                  <Button type="submit" variant="contained" disabled={imageFormBusy}>
                    {imageFormBusy ? <CircularProgress size={20} color="inherit" /> : 'Add Image'}
                  </Button>
                </Stack>
              </SurfaceCard>
            </Stack>
          )}
        </Grid>
      </Grid>

      {/* Delete event confirmation */}
      <Dialog open={Boolean(deleteEventDialog)} onClose={() => setDeleteEventDialog(null)}>
        <DialogTitle>Delete Event</DialogTitle>
        <DialogContent>
          <Typography>
            Delete <strong>{deleteEventDialog?.title}</strong> and all its images? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteEventDialog(null)}>Cancel</Button>
          <Button color="error" onClick={handleDeleteEvent} disabled={deleteBusy}>
            {deleteBusy ? <CircularProgress size={18} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete image confirmation */}
      <Dialog open={Boolean(deleteImageDialog)} onClose={() => setDeleteImageDialog(null)}>
        <DialogTitle>Delete Image</DialogTitle>
        <DialogContent>
          <Typography>Remove this image from the event? This cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteImageDialog(null)}>Cancel</Button>
          <Button color="error" onClick={handleDeleteImage} disabled={deleteBusy}>
            {deleteBusy ? <CircularProgress size={18} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default StaffGallery;
