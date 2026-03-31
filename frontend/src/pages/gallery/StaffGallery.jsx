import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import CollectionsRoundedIcon from '@mui/icons-material/CollectionsRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded';
import {
  Alert,
  Autocomplete,
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
  LinearProgress,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';
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
  uploadGalleryFile,
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

const EVENT_TYPES = ['Bistro', 'Cafe'];

const emptyEventForm = { slug: '', title: '', date_label: '', summary: '', event_type: 'Bistro', cover_image_url: '', sort_order: '' };
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
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [imageFormBusy, setImageFormBusy] = useState(false);
  const [imageFormError, setImageFormError] = useState('');
  const fileInputRef = useRef(null);

  const [deleteEventDialog, setDeleteEventDialog] = useState(null);
  const [deleteImageDialog, setDeleteImageDialog] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // — Home slideshow state —
  const [homeImages, setHomeImages] = useState([]);
  const [homeLoading, setHomeLoading] = useState(false);
  const [homeSelectedFiles, setHomeSelectedFiles] = useState([]);
  const [homeUploadProgress, setHomeUploadProgress] = useState(null);
  const [homeFormBusy, setHomeFormBusy] = useState(false);
  const [homeFormError, setHomeFormError] = useState('');
  const [deleteHomeImageDialog, setDeleteHomeImageDialog] = useState(null);
  const homeFileInputRef = useRef(null);

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
      const images = await fetchAdminEventImages(apiFetch, slug);
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

  // Load events and home images once authenticated
  useEffect(() => {
    if (auth.token) {
      loadEvents();
      loadHomeImages();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.token]);

  // Load images when an event is selected
  useEffect(() => {
    if (selectedSlug) loadImages(selectedSlug);
  }, [selectedSlug]);

  // Revoke object URLs on cleanup to avoid memory leaks
  useEffect(() => {
    return () => {
      selectedFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFiles]);

  useEffect(() => {
    return () => {
      homeSelectedFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeSelectedFiles]);

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

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    // Revoke any existing previews before replacing
    selectedFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    const next = files.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      altText: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
    }));
    setSelectedFiles(next);
    setImageForm(emptyImageForm);
  };

  const handleAddImage = async (event) => {
    event.preventDefault();
    if (!selectedSlug || selectedFiles.length === 0) return;
    setImageFormBusy(true);
    setImageFormError('');
    setUploadProgress({ done: 0, total: selectedFiles.length });
    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const { file, altText } = selectedFiles[i];
        const upload = await uploadGalleryFile(apiFetch, selectedSlug, file);
        await addGalleryImage(apiFetch, selectedSlug, {
          image_url: upload?.filename || file.name,
          alt_text: altText,
          sort_order: imageForm.sort_order !== '' ? Number(imageForm.sort_order) + i : i,
          is_preview: imageForm.is_preview,
        });
        setUploadProgress({ done: i + 1, total: selectedFiles.length });
      }
      selectedFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl));
      setSelectedFiles([]);
      setImageForm(emptyImageForm);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadImages(selectedSlug);
    } catch (error) {
      setImageFormError(error.message);
    } finally {
      setImageFormBusy(false);
      setUploadProgress(null);
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

  // — Home slideshow handlers —

  const loadHomeImages = async () => {
    setHomeLoading(true);
    try {
      const images = await fetchAdminEventImages(apiFetch, 'home');
      setHomeImages(images);
    } catch {
      setHomeImages([]);
    } finally {
      setHomeLoading(false);
    }
  };

  // Silently creates the reserved "home" gallery event if it doesn't exist yet.
  const ensureHomeEvent = async () => {
    try {
      await createGalleryEvent(apiFetch, {
        slug: 'home',
        title: 'Home Slideshow',
        date_label: '',
        summary: 'Background photos for the home page.',
        event_type: 'Home',
        cover_image_url: 'placeholder',
        sort_order: -1,
      });
    } catch {
      // "slug already exists" is the expected case — ignore it.
    }
  };

  const handleHomeFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    homeSelectedFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    setHomeSelectedFiles(files.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      altText: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
    })));
  };

  const handleAddHomeImages = async (e) => {
    e.preventDefault();
    if (!homeSelectedFiles.length) return;
    setHomeFormBusy(true);
    setHomeFormError('');
    setHomeUploadProgress({ done: 0, total: homeSelectedFiles.length });
    try {
      await ensureHomeEvent();
      for (let i = 0; i < homeSelectedFiles.length; i++) {
        const { file, altText } = homeSelectedFiles[i];
        const upload = await uploadGalleryFile(apiFetch, 'home', file);
        await addGalleryImage(apiFetch, 'home', {
          image_url: upload?.filename || file.name,
          alt_text: altText,
          sort_order: i,
          is_preview: false,
        });
        setHomeUploadProgress({ done: i + 1, total: homeSelectedFiles.length });
      }
      homeSelectedFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl));
      setHomeSelectedFiles([]);
      if (homeFileInputRef.current) homeFileInputRef.current.value = '';
      await loadHomeImages();
    } catch (error) {
      setHomeFormError(error.message);
    } finally {
      setHomeFormBusy(false);
      setHomeUploadProgress(null);
    }
  };

  const handleDeleteHomeImage = async () => {
    if (!deleteHomeImageDialog) return;
    setDeleteBusy(true);
    try {
      await deleteGalleryImage(apiFetch, 'home', deleteHomeImageDialog.id);
      setDeleteHomeImageDialog(null);
      await loadHomeImages();
    } catch (error) {
      setHomeFormError(error.message);
      setDeleteHomeImageDialog(null);
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

      {/* Home slideshow management */}
      <SurfaceCard contentSx={{ p: { xs: 2.5, sm: 3 } }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2.5 }}>
          <HomeRoundedIcon color="secondary" />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Home Slideshow</Typography>
            <Typography variant="caption" color="text.secondary">These photos cycle as the background on the home page.</Typography>
          </Box>
        </Stack>

        {homeFormError ? <Alert severity="error" sx={{ mb: 2 }}>{homeFormError}</Alert> : null}

        {/* Current home images */}
        {homeLoading ? (
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 2 }}>
            <CircularProgress size={16} />
            <Typography variant="caption" color="text.secondary">Loading...</Typography>
          </Stack>
        ) : homeImages.length > 0 ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2.5 }}>
            {homeImages.map((image) => (
              <Box key={`${image.id}-${image.imageUrl}`} sx={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
                <Box
                  sx={{
                    width: '100%',
                    height: '100%',
                    borderRadius: 1,
                    backgroundImage: `url(${image.imageUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    border: '1px solid rgba(217,195,161,0.12)',
                  }}
                />
                <Tooltip title="Remove from slideshow">
                  <IconButton
                    size="small"
                    onClick={() => setDeleteHomeImageDialog(image)}
                    sx={{
                      position: 'absolute',
                      top: -6,
                      right: -6,
                      width: 22,
                      height: 22,
                      backgroundColor: 'rgba(18,15,13,0.9)',
                      border: '1px solid rgba(217,195,161,0.2)',
                      color: 'text.secondary',
                      '&:hover': { backgroundColor: 'rgba(40,20,20,0.95)', color: 'error.main' },
                    }}
                  >
                    <DeleteRoundedIcon sx={{ fontSize: 13 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            ))}
          </Box>
        ) : (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            No home cover photos yet.
          </Typography>
        )}

        {/* Upload new home photos */}
        <Stack component="form" onSubmit={handleAddHomeImages} spacing={2}>
          <input ref={homeFileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleHomeFileSelect} />
          <Box
            onClick={() => homeFileInputRef.current?.click()}
            sx={{
              border: '1px dashed',
              borderColor: homeSelectedFiles.length ? 'secondary.main' : 'rgba(217,195,161,0.3)',
              borderRadius: 2,
              overflow: 'hidden',
              cursor: 'pointer',
              transition: 'border-color 140ms ease',
              '&:hover': { borderColor: 'rgba(217,195,161,0.6)' },
            }}
          >
            {homeSelectedFiles.length > 0 ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, p: 1, backgroundColor: 'rgba(0,0,0,0.25)' }}>
                {homeSelectedFiles.map(({ previewUrl, file }) => (
                  <Box
                    key={previewUrl}
                    title={file.name}
                    sx={{ width: 56, height: 56, flexShrink: 0, borderRadius: 1, backgroundImage: `url(${previewUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                  />
                ))}
              </Box>
            ) : (
              <Stack alignItems="center" justifyContent="center" spacing={0.5} sx={{ py: 3 }}>
                <PhotoCameraRoundedIcon sx={{ fontSize: 28, color: 'text.secondary', opacity: 0.45 }} />
                <Typography color="text.secondary" sx={{ fontSize: '0.85rem' }}>Tap to pick photos</Typography>
              </Stack>
            )}
          </Box>
          {homeSelectedFiles.length > 0 ? (
            <Typography variant="caption" color="text.secondary">
              {homeSelectedFiles.length} file{homeSelectedFiles.length !== 1 ? 's' : ''} selected
            </Typography>
          ) : null}
          {homeUploadProgress ? (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                Uploading {homeUploadProgress.done} / {homeUploadProgress.total}…
              </Typography>
              <LinearProgress variant="determinate" value={(homeUploadProgress.done / homeUploadProgress.total) * 100} color="secondary" />
            </Box>
          ) : null}
          <Button type="submit" variant="contained" disabled={homeFormBusy || homeSelectedFiles.length === 0} sx={{ alignSelf: 'flex-start' }}>
            {homeFormBusy ? <CircularProgress size={18} color="inherit" /> : `Add ${homeSelectedFiles.length > 1 ? `${homeSelectedFiles.length} Photos` : 'Photo'}`}
          </Button>
        </Stack>
      </SurfaceCard>

      <Grid container spacing={3} alignItems="flex-start">

        {/* Left — event list + create form */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Stack spacing={3}>

            {/* Event list */}
            <SurfaceCard contentSx={{ p: { xs: 2.5, sm: 3 } }}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2.5 }}>
                <CollectionsRoundedIcon color="secondary" />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Events</Typography>
              </Stack>
              {eventsError ? <Alert severity="error" sx={{ mb: 2 }}>{eventsError}</Alert> : null}
              {loadingEvents ? (
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 3 }}>
                  <CircularProgress size={18} />
                  <Typography color="text.secondary">Loading events...</Typography>
                </Stack>
              ) : events.length === 0 ? (
                <Typography color="text.secondary" sx={{ py: 1 }}>No events yet.</Typography>
              ) : (
                <Stack divider={<Divider sx={{ borderColor: 'rgba(217,195,161,0.08)' }} />}>
                  {events.map((event) => (
                    <Stack
                      key={event.slug}
                      data-testid="event-row"
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      spacing={1.5}
                      sx={{
                        py: 1.5,
                        px: 1,
                        borderRadius: 1,
                        cursor: 'pointer',
                        backgroundColor: selectedSlug === event.slug ? 'rgba(176, 122, 68, 0.14)' : 'transparent',
                        transition: 'background-color 140ms ease',
                        '&:hover': { backgroundColor: selectedSlug === event.slug ? 'rgba(176, 122, 68, 0.18)' : 'rgba(255,255,255,0.04)' },
                      }}
                      onClick={() => setSelectedSlug(event.slug === selectedSlug ? null : event.slug)}
                    >
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: 1,
                          flexShrink: 0,
                          overflow: 'hidden',
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          backgroundImage: event.coverImage ? `url(${event.coverImage})` : 'none',
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          border: '1px solid rgba(217,195,161,0.12)',
                        }}
                      />
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{ fontWeight: 600, fontSize: '0.95rem' }} noWrap>{event.title}</Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>{event.dateLabel} · {event.slug}</Typography>
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
            <SurfaceCard contentSx={{ p: { xs: 2.5, sm: 3 } }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2.5 }}>New Event</Typography>
              <Stack component="form" onSubmit={handleCreateEvent} spacing={2.5}>
                <TextField label="Slug *" value={eventForm.slug} onChange={(e) => setEventForm((f) => ({ ...f, slug: e.target.value }))} required fullWidth size="small" placeholder="spring-supper-2026" />
                <TextField label="Title *" value={eventForm.title} onChange={(e) => setEventForm((f) => ({ ...f, title: e.target.value }))} required fullWidth size="small" />
                <TextField label="Date Label *" value={eventForm.date_label} onChange={(e) => setEventForm((f) => ({ ...f, date_label: e.target.value }))} required fullWidth size="small" placeholder="April 2026" />
                <Autocomplete
                  freeSolo
                  options={EVENT_TYPES}
                  value={eventForm.event_type}
                  onChange={(_, value) => setEventForm((f) => ({ ...f, event_type: value || '' }))}
                  onInputChange={(_, value) => setEventForm((f) => ({ ...f, event_type: value }))}
                  renderInput={(params) => (
                    <TextField {...params} label="Event Type" size="small" fullWidth />
                  )}
                />
                <TextField label="Summary *" value={eventForm.summary} onChange={(e) => setEventForm((f) => ({ ...f, summary: e.target.value }))} required fullWidth size="small" multiline rows={2} />
                <TextField
                  label="Cover Image File *"
                  value={eventForm.cover_image_url}
                  onChange={(e) => setEventForm((f) => ({ ...f, cover_image_url: e.target.value }))}
                  required
                  fullWidth
                  size="small"
                  placeholder="cover.jpg"
                  helperText={r2BaseUrl && eventForm.slug ? `${r2BaseUrl.replace(/\/+$/, '')}/${eventForm.slug.replace(/^\/+|\/+$/g, '')}/<file>` : 'Filename under the event slug folder in R2.'}
                />
                <TextField label="Sort Order" value={eventForm.sort_order} onChange={(e) => setEventForm((f) => ({ ...f, sort_order: e.target.value }))} fullWidth size="small" type="number" />
                {eventFormError ? <Alert severity="error">{eventFormError}</Alert> : null}
                <Button type="submit" variant="contained" disabled={eventFormBusy} fullWidth>
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
              <Stack spacing={1} alignItems="center" sx={{ py: 5 }}>
                <CollectionsRoundedIcon sx={{ fontSize: 40, color: 'text.secondary', opacity: 0.4 }} />
                <Typography color="text.secondary">Select an event to manage its photos.</Typography>
              </Stack>
            </SurfaceCard>
          ) : (
            <Stack spacing={3}>

              {/* Image list */}
              <SurfaceCard contentSx={{ p: { xs: 2.5, sm: 3 } }}>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2.5 }}>
                  <AddPhotoAlternateRoundedIcon color="secondary" />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>{selectedEvent.title}</Typography>
                    <Typography variant="caption" color="text.secondary">{selectedEvent.slug}</Typography>
                  </Box>
                </Stack>

                {loadingImages ? (
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 3 }}>
                    <CircularProgress size={18} />
                    <Typography color="text.secondary">Loading images...</Typography>
                  </Stack>
                ) : eventImages.length === 0 ? (
                  <Typography color="text.secondary">No images registered yet.</Typography>
                ) : (
                  <Stack divider={<Divider sx={{ borderColor: 'rgba(217,195,161,0.08)' }} />}>
                    {eventImages.map((image) => (
                      <Stack
                        key={`${image.id}-${image.imageUrl}`}
                        direction="row"
                        alignItems="center"
                        spacing={1.5}
                        sx={{ py: 1.5 }}
                      >
                        <Box
                          sx={{
                            width: 52,
                            height: 52,
                            borderRadius: 1,
                            flexShrink: 0,
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            backgroundImage: image.imageUrl ? `url(${image.imageUrl})` : 'none',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            border: '1px solid rgba(217,195,161,0.12)',
                          }}
                        />
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography sx={{ fontSize: '0.85rem', wordBreak: 'break-all', lineHeight: 1.4 }}>{image.imageUrl.split('/').pop()}</Typography>
                          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.25 }}>
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
              </SurfaceCard>

              {/* Add photo form */}
              <SurfaceCard contentSx={{ p: { xs: 2.5, sm: 3 } }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2.5 }}>Add Photo</Typography>
                <Stack component="form" onSubmit={handleAddImage} spacing={2.5}>

                  {/* File picker — supports multiple files, opens camera roll on mobile */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                  />
                  <Box
                    onClick={() => fileInputRef.current?.click()}
                    sx={{
                      border: '1px dashed',
                      borderColor: selectedFiles.length ? 'secondary.main' : 'rgba(217,195,161,0.3)',
                      borderRadius: 2,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      transition: 'border-color 140ms ease',
                      '&:hover': { borderColor: 'rgba(217,195,161,0.6)' },
                    }}
                  >
                    {selectedFiles.length > 0 ? (
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                          gap: 0.5,
                          p: 1,
                          backgroundColor: 'rgba(0,0,0,0.25)',
                        }}
                      >
                        {selectedFiles.map(({ previewUrl, file }) => (
                          <Box
                            key={previewUrl}
                            sx={{
                              aspectRatio: '1',
                              backgroundImage: `url(${previewUrl})`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                              borderRadius: 1,
                            }}
                            title={file.name}
                          />
                        ))}
                      </Box>
                    ) : (
                      <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ py: 5 }}>
                        <PhotoCameraRoundedIcon sx={{ fontSize: 36, color: 'text.secondary', opacity: 0.45 }} />
                        <Typography color="text.secondary" sx={{ fontSize: '0.9rem' }}>
                          Tap to pick photos — select multiple at once
                        </Typography>
                      </Stack>
                    )}
                  </Box>

                  {selectedFiles.length > 0 ? (
                    <Typography variant="caption" color="text.secondary">
                      {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected — alt text and sort order apply to all
                    </Typography>
                  ) : null}

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
                    <TextField
                      label="Starting Sort Order"
                      value={imageForm.sort_order}
                      onChange={(e) => setImageForm((f) => ({ ...f, sort_order: e.target.value }))}
                      size="small"
                      type="number"
                      sx={{ width: { xs: '100%', sm: 160 } }}
                    />
                    <FormControlLabel
                      control={<Checkbox checked={imageForm.is_preview} onChange={(e) => setImageForm((f) => ({ ...f, is_preview: e.target.checked }))} color="secondary" />}
                      label="Show as preview on gallery index"
                    />
                  </Stack>
                  {imageFormError ? <Alert severity="error">{imageFormError}</Alert> : null}
                  {uploadProgress ? (
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                        Uploading {uploadProgress.done} / {uploadProgress.total}…
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={(uploadProgress.done / uploadProgress.total) * 100}
                        color="secondary"
                      />
                    </Box>
                  ) : null}
                  <Button type="submit" variant="contained" disabled={imageFormBusy || selectedFiles.length === 0} fullWidth>
                    {imageFormBusy ? <CircularProgress size={20} color="inherit" /> : `Add ${selectedFiles.length > 1 ? `${selectedFiles.length} Photos` : 'Photo'}`}
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

      {/* Delete home slideshow image confirmation */}
      <Dialog open={Boolean(deleteHomeImageDialog)} onClose={() => setDeleteHomeImageDialog(null)}>
        <DialogTitle>Remove from Slideshow</DialogTitle>
        <DialogContent>
          <Typography>Remove this photo from the home page slideshow?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteHomeImageDialog(null)}>Cancel</Button>
          <Button color="error" onClick={handleDeleteHomeImage} disabled={deleteBusy}>
            {deleteBusy ? <CircularProgress size={18} /> : 'Remove'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default StaffGallery;
