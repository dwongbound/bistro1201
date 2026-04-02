import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CollectionsRoundedIcon from '@mui/icons-material/CollectionsRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded';
import StarBorderRoundedIcon from '@mui/icons-material/StarBorderRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
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
  IconButton,
  LinearProgress,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { closestCenter, DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useRef, useState } from 'react';
import { createApiFetch } from '../../common/apiClient';
import { getApiUrl } from '../../common/appConfig';
import PageIntro from '../../common/PageIntro';
import SurfaceCard from '../../common/SurfaceCard';
import { useFormErrors } from '../../common/useFormErrors';
import { fetchGalleryEvents } from './galleryApi';
import {
  addGalleryImage,
  createGalleryEvent,
  deleteGalleryEvent,
  deleteGalleryImage,
  fetchAdminEventImages,
  updateGalleryEvent,
  updateGalleryImage,
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

export function titleToSlug(title) {
  return title.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

/** Pure helper — moves item from one index to another. Exported for unit testing. */
export function reorderHomeImages(images, fromId, toId) {
  const oldIdx = images.findIndex((img) => img.id === fromId);
  const newIdx = images.findIndex((img) => img.id === toId);
  return arrayMove(images, oldIdx, newIdx);
}

/** Single draggable home-slideshow thumbnail used inside the DndContext. */
function SortableHomeThumb({ image, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: image.id });
  return (
    <Box
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      sx={{ position: 'relative', width: 80, height: 80, flexShrink: 0, opacity: isDragging ? 0 : 1 }}
    >
      {/* Drag handle — only this area starts the drag */}
      <Box
        {...listeners}
        sx={{
          position: 'absolute', inset: 0, zIndex: 1, cursor: 'grab', borderRadius: 1,
          '&:active': { cursor: 'grabbing' },
        }}
      />
      <Box
        sx={{
          width: '100%', height: '100%', borderRadius: 1,
          backgroundImage: `url(${image.imageUrl})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          border: '1px solid rgba(217,195,161,0.12)',
        }}
      />
      <Box sx={{ position: 'absolute', bottom: 2, left: 2, color: 'rgba(255,255,255,0.6)', lineHeight: 0, pointerEvents: 'none' }}>
        <DragIndicatorRoundedIcon sx={{ fontSize: 14 }} />
      </Box>
      <Tooltip title="Remove from slideshow">
        <IconButton
          size="small"
          onClick={onDelete}
          sx={{
            position: 'absolute', top: -6, right: -6, width: 22, height: 22, zIndex: 2,
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
  );
}

const emptyEventForm = { title: '', date_label: '', summary: '', event_type: 'Bistro', sort_order: '' };
/**
 * Hidden staff-only page at /staff/gallery for managing gallery events and images.
 * Not linked in the nav — access by direct URL only.
 */
function StaffGallery() {
  const apiUrl = getApiUrl();

  const [accessCode, setAccessCode] = useState('');
  const [auth, setAuth] = useState({ token: '', role: '' });
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');

  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [eventsError, setEventsError] = useState('');

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [eventForm, setEventForm] = useState(emptyEventForm);
  const [eventFormBusy, setEventFormBusy] = useState(false);
  const [eventFormError, setEventFormError] = useState('');
  const createFormErrors = useFormErrors();

  const [editingSlug, setEditingSlug] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', date_label: '', summary: '', event_type: '' });
  const [editFormBusy, setEditFormBusy] = useState(false);
  const [editFormError, setEditFormError] = useState('');

  // Manage dialog — images for the currently-open event
  const [manageEvent, setManageEvent] = useState(null);
  const [manageImages, setManageImages] = useState([]);
  const [manageLoading, setManageLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [imageFormBusy, setImageFormBusy] = useState(false);
  const [imageFormError, setImageFormError] = useState('');
  const [settingCover, setSettingCover] = useState(null);
  const fileInputRef = useRef(null);

  const [deleteEventDialog, setDeleteEventDialog] = useState(null);
  const [deleteImageDialog, setDeleteImageDialog] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Home slideshow state
  const [homeImages, setHomeImages] = useState([]);
  const [homeLoading, setHomeLoading] = useState(false);
  const [homeSelectedFiles, setHomeSelectedFiles] = useState([]);
  const [homeUploadProgress, setHomeUploadProgress] = useState(null);
  const [homeFormError, setHomeFormError] = useState('');
  const [deleteHomeImageDialog, setDeleteHomeImageDialog] = useState(null);
  const [activeDragId, setActiveDragId] = useState(null);
  const homeFileInputRef = useRef(null);

  const homeSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const clearAuth = () => {
    setAuth({ token: '', role: '' });
    clearGalleryStaffCode();
  };

  const apiFetch = createApiFetch({
    apiUrl,
    getToken: () => auth.token,
    getServiceKey: () => readGalleryStaffCode(),
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

  const loadManageImages = async (slug) => {
    setManageLoading(true);
    setManageImages([]);
    try {
      const images = await fetchAdminEventImages(apiFetch, slug);
      setManageImages(images);
    } catch {
      setManageImages([]);
    } finally {
      setManageLoading(false);
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

  // Load manage images when the dialog opens
  useEffect(() => {
    if (manageEvent) loadManageImages(manageEvent.slug);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manageEvent?.slug]);

  // Revoke object URLs on cleanup
  useEffect(() => {
    return () => { selectedFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl)); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFiles]);

  useEffect(() => {
    return () => { homeSelectedFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl)); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeSelectedFiles]);

  const handleLogin = (e) => {
    e.preventDefault();
    tryLogin(accessCode);
  };

  // ——— Create event ———

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    if (!createFormErrors.validate({ title: eventForm.title, date_label: eventForm.date_label, summary: eventForm.summary })) return;
    setEventFormBusy(true);
    setEventFormError('');
    const slug = titleToSlug(eventForm.title);
    try {
      await createGalleryEvent(apiFetch, {
        ...eventForm,
        slug,
        sort_order: eventForm.sort_order !== '' ? Number(eventForm.sort_order) : 0,
      });
      setEventForm(emptyEventForm);
      createFormErrors.clearAll();
      setShowCreateForm(false);
      await loadEvents();
    } catch (error) {
      if (error.message?.toLowerCase().includes('already exists')) {
        setEventFormError(`An event with slug "${slug}" already exists — try a different title.`);
      } else {
        setEventFormError(error.message);
      }
    } finally {
      setEventFormBusy(false);
    }
  };

  const handleCancelCreate = () => {
    setShowCreateForm(false);
    setEventForm(emptyEventForm);
    createFormErrors.clearAll();
    setEventFormError('');
  };

  // ——— Inline edit ———

  const startEditing = (ev) => {
    setEditingSlug(ev.slug);
    setEditForm({ title: ev.title, date_label: ev.dateLabel, summary: ev.summary, event_type: ev.eventType });
    setEditFormError('');
  };

  const handleSaveEdit = async () => {
    setEditFormBusy(true);
    setEditFormError('');
    try {
      await updateGalleryEvent(apiFetch, editingSlug, editForm);
      setEditingSlug(null);
      await loadEvents();
      // Keep manage dialog in sync if the edited event is open
      if (manageEvent?.slug === editingSlug) {
        setManageEvent((prev) => prev ? { ...prev, title: editForm.title, dateLabel: editForm.date_label } : null);
      }
    } catch (error) {
      setEditFormError(error.message);
    } finally {
      setEditFormBusy(false);
    }
  };

  // ——— Delete event ———

  const handleDeleteEvent = async () => {
    if (!deleteEventDialog) return;
    setDeleteBusy(true);
    try {
      await deleteGalleryEvent(apiFetch, deleteEventDialog.slug);
      setDeleteEventDialog(null);
      if (manageEvent?.slug === deleteEventDialog.slug) setManageEvent(null);
      await loadEvents();
    } catch (error) {
      setEventsError(error.message);
      setDeleteEventDialog(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  // ——— Manage dialog / images ———

  const openManage = (ev) => {
    setManageEvent(ev);
    setSelectedFiles([]);
    setImageFormError('');
  };

  const closeManage = () => {
    setManageEvent(null);
    setManageImages([]);
    setSelectedFiles([]);
    setImageFormError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSetCover = async (image) => {
    if (!manageEvent) return;
    setSettingCover(image.id);
    try {
      await updateGalleryEvent(apiFetch, manageEvent.slug, { cover_image_url: image.imageUrl });
      await loadEvents();
      // Update the local event so the star re-renders immediately
      setManageEvent((prev) => prev ? { ...prev, coverImage: image.imageUrl } : null);
    } catch (error) {
      setImageFormError(error.message);
    } finally {
      setSettingCover(null);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    selectedFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    const pendingFiles = files.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      altText: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
    }));
    setSelectedFiles(pendingFiles);
    void handleAddImage(pendingFiles);
  };

  const handleAddImage = async (filesToUpload) => {
    if (!manageEvent || filesToUpload.length === 0) return;
    setImageFormBusy(true);
    setImageFormError('');
    setUploadProgress({ done: 0, total: filesToUpload.length });
    try {
      for (let i = 0; i < filesToUpload.length; i++) {
        const { file, altText } = filesToUpload[i];
        const upload = await uploadGalleryFile(apiFetch, manageEvent.slug, file);
        await addGalleryImage(apiFetch, manageEvent.slug, {
          image_url: upload?.filename || file.name,
          alt_text: altText,
          sort_order: manageImages.length + i,
          is_preview: false,
        });
        setUploadProgress({ done: i + 1, total: filesToUpload.length });
      }
      filesToUpload.forEach((f) => URL.revokeObjectURL(f.previewUrl));
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadManageImages(manageEvent.slug);
    } catch (error) {
      setImageFormError(error.message);
    } finally {
      setImageFormBusy(false);
      setUploadProgress(null);
    }
  };

  const handleDeleteImage = async () => {
    if (!deleteImageDialog || !manageEvent) return;
    setDeleteBusy(true);
    try {
      await deleteGalleryImage(apiFetch, manageEvent.slug, deleteImageDialog.id);
      setDeleteImageDialog(null);
      await loadManageImages(manageEvent.slug);
    } catch (error) {
      setImageFormError(error.message);
      setDeleteImageDialog(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  // ——— Home slideshow ———

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

  const ensureHomeEvent = async () => {
    try {
      await createGalleryEvent(apiFetch, {
        slug: 'home',
        title: 'Home Slideshow',
        date_label: '',
        summary: 'Background photos for the home page.',
        event_type: 'Home',
        sort_order: -1,
      });
    } catch {
      // slug already exists — expected
    }
  };

  const uploadHomeFiles = async (filesToUpload) => {
    if (!filesToUpload.length) return;
    setHomeFormError('');
    setHomeUploadProgress({ done: 0, total: filesToUpload.length });
    try {
      await ensureHomeEvent();
      for (let i = 0; i < filesToUpload.length; i++) {
        const { file, altText } = filesToUpload[i];
        const upload = await uploadGalleryFile(apiFetch, 'home', file);
        await addGalleryImage(apiFetch, 'home', {
          image_url: upload?.filename || file.name,
          alt_text: altText,
          sort_order: homeImages.length + i,
          is_preview: false,
        });
        setHomeUploadProgress({ done: i + 1, total: filesToUpload.length });
      }
      filesToUpload.forEach((f) => URL.revokeObjectURL(f.previewUrl));
      setHomeSelectedFiles([]);
      if (homeFileInputRef.current) homeFileInputRef.current.value = '';
      await loadHomeImages();
    } catch (error) {
      setHomeFormError(error.message);
    } finally {
      setHomeUploadProgress(null);
    }
  };

  const handleHomeFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    homeSelectedFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    const newFiles = files.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      altText: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
    }));
    setHomeSelectedFiles(newFiles);
    await uploadHomeFiles(newFiles);
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

  const handleHomeDragStart = ({ active }) => setActiveDragId(active.id);

  const handleHomeDragEnd = async ({ active, over }) => {
    setActiveDragId(null);
    if (!over || active.id === over.id) return;
    const reordered = reorderHomeImages(homeImages, active.id, over.id);
    setHomeImages(reordered);
    try {
      await Promise.all(reordered.map((img, i) => updateGalleryImage(apiFetch, 'home', img.id, { sort_order: i })));
    } catch {
      await loadHomeImages();
    }
  };

  // ——— Login gate ———
  if (!auth.token) {
    return (
      <Box sx={{ display: 'grid', gap: 4 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { md: '1fr 1fr' }, gap: 4, alignItems: 'stretch' }}>
          <SurfaceCard
            cardSx={{ background: 'linear-gradient(145deg, rgba(36,28,22,0.98), rgba(56,44,34,0.95))' }}
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
          <SurfaceCard contentSx={{ p: { xs: 3, sm: 4 } }}>
            <Stack component="form" noValidate onSubmit={handleLogin} spacing={3}>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>Staff Login</Typography>
              <TextField
                type="password"
                label="Staff Access Code"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                fullWidth
              />
              <Button type="submit" variant="contained" size="large" disabled={authBusy}>
                {authBusy ? <CircularProgress size={22} color="inherit" /> : 'Sign In'}
              </Button>
              {authError ? <Alert severity="error">{authError}</Alert> : null}
            </Stack>
          </SurfaceCard>
        </Box>
      </Box>
    );
  }

  // ——— Authenticated view ———
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

      {/* ——— Home slideshow ——— */}
      <SurfaceCard contentSx={{ p: { xs: 2.5, sm: 3 } }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2.5 }}>
          <HomeRoundedIcon color="secondary" />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Home Slideshow</Typography>
            <Typography variant="caption" color="text.secondary">These photos cycle as the background on the home page. Drag to reorder.</Typography>
          </Box>
        </Stack>

        {homeFormError ? <Alert severity="error" sx={{ mb: 2 }}>{homeFormError}</Alert> : null}

        {homeLoading ? (
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 2 }}>
            <CircularProgress size={16} />
            <Typography variant="caption" color="text.secondary">Loading...</Typography>
          </Stack>
        ) : homeImages.length > 0 ? (
          <DndContext
            sensors={homeSensors}
            collisionDetection={closestCenter}
            onDragStart={handleHomeDragStart}
            onDragEnd={handleHomeDragEnd}
          >
            <SortableContext items={homeImages.map((img) => img.id)} strategy={rectSortingStrategy}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2.5 }}>
                {homeImages.map((image) => (
                  <SortableHomeThumb
                    key={image.id}
                    image={image}
                    onDelete={() => setDeleteHomeImageDialog(image)}
                  />
                ))}
              </Box>
            </SortableContext>
            <DragOverlay>
              {activeDragId ? (() => {
                const img = homeImages.find((i) => i.id === activeDragId);
                return img ? (
                  <Box sx={{
                    width: 80, height: 80, borderRadius: 1,
                    backgroundImage: `url(${img.imageUrl})`,
                    backgroundSize: 'cover', backgroundPosition: 'center',
                    border: '2px solid rgba(176,122,68,0.8)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    cursor: 'grabbing',
                  }} />
                ) : null;
              })() : null}
            </DragOverlay>
          </DndContext>
        ) : (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            No home cover photos yet.
          </Typography>
        )}

        {/* Upload new home photos */}
        <Stack spacing={2}>
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
                <Typography color="text.secondary" sx={{ fontSize: '0.85rem' }}>Add photos</Typography>
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
        </Stack>
      </SurfaceCard>

      {/* ——— Events ——— */}
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
        ) : (
          <Stack divider={<Divider sx={{ borderColor: 'rgba(217,195,161,0.08)' }} />}>
            {events.length === 0 && !showCreateForm ? (
              <Typography color="text.secondary" sx={{ py: 1 }}>No events yet.</Typography>
            ) : null}

            {events.map((event) => (
              <Box key={event.slug} data-testid="event-row">
                {/* Row */}
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1.5}
                  sx={{ py: 1.5, px: 1 }}
                >
                  <Box
                    sx={{
                      width: 48, height: 48, borderRadius: 1, flexShrink: 0,
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      backgroundImage: event.coverImage ? `url(${event.coverImage})` : 'none',
                      backgroundSize: 'cover', backgroundPosition: 'center',
                      border: '1px solid rgba(217,195,161,0.12)',
                    }}
                  />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.95rem' }} noWrap>{event.title}</Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>{event.dateLabel} · {event.slug}</Typography>
                  </Box>
                  <Stack direction="row" spacing={0.75} flexShrink={0}>
                    <Button
                      size="small"
                      startIcon={<EditRoundedIcon />}
                      variant={editingSlug === event.slug ? 'contained' : 'outlined'}
                      onClick={() => editingSlug === event.slug ? setEditingSlug(null) : startEditing(event)}
                      sx={{ minWidth: 0, px: { xs: 1, sm: undefined }, '& .MuiButton-startIcon': { mx: { xs: 0, sm: undefined } } }}
                    >
                      <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Edit</Box>
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<DeleteRoundedIcon />}
                      variant="outlined"
                      onClick={() => setDeleteEventDialog(event)}
                      sx={{ minWidth: 0, borderColor: 'rgba(211,47,47,0.4)', px: { xs: 1, sm: undefined }, '& .MuiButton-startIcon': { mx: { xs: 0, sm: undefined } } }}
                    >
                      <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Delete</Box>
                    </Button>
                    <Button
                      size="small"
                      startIcon={<AddPhotoAlternateRoundedIcon />}
                      variant="outlined"
                      onClick={() => openManage(event)}
                      sx={{ minWidth: 0, px: { xs: 1, sm: undefined }, '& .MuiButton-startIcon': { mx: { xs: 0, sm: undefined } } }}
                    >
                      <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Manage</Box>
                    </Button>
                  </Stack>
                </Stack>

                {/* Inline edit form */}
                {editingSlug === event.slug ? (
                  <Stack spacing={1.5} sx={{ px: 1, pb: 2 }}>
                    {editFormError ? <Alert severity="error" sx={{ fontSize: '0.8rem' }}>{editFormError}</Alert> : null}
                    <TextField label="Title" value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} size="small" fullWidth />
                    <TextField label="Date Label" value={editForm.date_label} onChange={(e) => setEditForm((f) => ({ ...f, date_label: e.target.value }))} size="small" fullWidth />
                    <Autocomplete
                      freeSolo
                      options={EVENT_TYPES}
                      value={editForm.event_type}
                      onChange={(_, value) => setEditForm((f) => ({ ...f, event_type: value || '' }))}
                      onInputChange={(_, value) => setEditForm((f) => ({ ...f, event_type: value }))}
                      renderInput={(params) => <TextField {...params} label="Event Type" size="small" fullWidth />}
                    />
                    <TextField label="Summary" value={editForm.summary} onChange={(e) => setEditForm((f) => ({ ...f, summary: e.target.value }))} size="small" fullWidth multiline rows={2} />
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={editFormBusy ? <CircularProgress size={14} color="inherit" /> : <CheckRoundedIcon />}
                        onClick={handleSaveEdit}
                        disabled={editFormBusy}
                      >
                        Save
                      </Button>
                      <Button size="small" startIcon={<CloseRoundedIcon />} onClick={() => setEditingSlug(null)}>Cancel</Button>
                    </Stack>
                  </Stack>
                ) : null}
              </Box>
            ))}

            {/* Expandable create form */}
            {showCreateForm ? (
              <Box sx={{ pt: 2, px: 1, pb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>New Event</Typography>
                <Stack component="form" noValidate onSubmit={handleCreateEvent} spacing={2}>
                  <TextField
                    label="Title"
                    value={eventForm.title}
                    onChange={(e) => {
                      const v = e.target.value;
                      createFormErrors.clearError('title');
                      setEventForm((f) => ({ ...f, title: v }));
                    }}
                    size="small"
                    fullWidth
                    error={Boolean(createFormErrors.errors.title)}
                    helperText={createFormErrors.errors.title || `Slug: ${titleToSlug(eventForm.title) || '—'}`}
                  />
                  <TextField
                    label="Date Label"
                    value={eventForm.date_label}
                    onChange={(e) => { createFormErrors.clearError('date_label'); setEventForm((f) => ({ ...f, date_label: e.target.value })); }}
                    size="small"
                    fullWidth
                    placeholder="April 2026"
                    error={Boolean(createFormErrors.errors.date_label)}
                    helperText={createFormErrors.errors.date_label}
                  />
                  <Autocomplete
                    freeSolo
                    options={EVENT_TYPES}
                    value={eventForm.event_type}
                    onChange={(_, value) => setEventForm((f) => ({ ...f, event_type: value || '' }))}
                    onInputChange={(_, value) => setEventForm((f) => ({ ...f, event_type: value }))}
                    renderInput={(params) => <TextField {...params} label="Event Type" size="small" fullWidth />}
                  />
                  <TextField
                    label="Summary"
                    value={eventForm.summary}
                    onChange={(e) => { createFormErrors.clearError('summary'); setEventForm((f) => ({ ...f, summary: e.target.value })); }}
                    size="small"
                    fullWidth
                    multiline
                    rows={2}
                    error={Boolean(createFormErrors.errors.summary)}
                    helperText={createFormErrors.errors.summary}
                  />
                  <TextField label="Sort Order" value={eventForm.sort_order} onChange={(e) => setEventForm((f) => ({ ...f, sort_order: e.target.value }))} size="small" type="number" sx={{ width: 160 }} />
                  {eventFormError ? <Alert severity="error">{eventFormError}</Alert> : null}
                  <Stack direction="row" spacing={1}>
                    <Button type="submit" variant="contained" disabled={eventFormBusy}>
                      {eventFormBusy ? <CircularProgress size={18} color="inherit" /> : 'Create Event'}
                    </Button>
                    <Button onClick={handleCancelCreate} startIcon={<CloseRoundedIcon />}>Cancel</Button>
                  </Stack>
                </Stack>
              </Box>
            ) : (
              /* "+ New Event" dotted trigger */
              <Box
                onClick={() => setShowCreateForm(true)}
                sx={{
                  mt: events.length > 0 ? 0 : 0,
                  border: '1px dashed',
                  borderColor: 'rgba(217,195,161,0.25)',
                  borderRadius: 1,
                  cursor: 'pointer',
                  transition: 'border-color 140ms ease, background-color 140ms ease',
                  '&:hover': { borderColor: 'rgba(217,195,161,0.55)', backgroundColor: 'rgba(255,255,255,0.03)' },
                }}
              >
                <Stack alignItems="center" justifyContent="center" direction="row" spacing={1} sx={{ py: 2 }}>
                  <AddRoundedIcon sx={{ fontSize: 18, color: 'text.secondary', opacity: 0.6 }} />
                  <Typography color="text.secondary" sx={{ fontSize: '0.875rem', opacity: 0.8 }}>New Event</Typography>
                </Stack>
              </Box>
            )}
          </Stack>
        )}
      </SurfaceCard>

      {/* ——— Manage images dialog ——— */}
      <Dialog
        open={Boolean(manageEvent)}
        onClose={closeManage}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { backgroundImage: 'none', backgroundColor: 'background.paper', border: '1px solid rgba(217,195,161,0.12)' } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{manageEvent?.title}</Typography>
            <Typography variant="caption" color="text.secondary">{manageEvent?.slug}</Typography>
          </Box>
          <IconButton size="small" onClick={closeManage}><CloseRoundedIcon fontSize="small" /></IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 2.5 }}>
          {imageFormError ? <Alert severity="error" sx={{ mb: 2 }}>{imageFormError}</Alert> : null}

          {/* Image list */}
          {manageLoading ? (
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 3 }}>
              <CircularProgress size={18} />
              <Typography color="text.secondary">Loading images...</Typography>
            </Stack>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                gap: 1.5,
              }}
            >
              {manageImages.map((image) => {
                const isCover = manageEvent && image.imageUrl === manageEvent.coverImage;
                return (
                  <Box
                    key={`${image.id}-${image.imageUrl}`}
                    sx={{
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: isCover ? 'secondary.main' : 'rgba(217,195,161,0.12)',
                      backgroundColor: isCover ? 'rgba(176,122,68,0.08)' : 'rgba(255,255,255,0.02)',
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        width: '100%',
                        aspectRatio: '4 / 3',
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        backgroundImage: image.imageUrl ? `url(${image.imageUrl})` : 'none',
                        backgroundSize: 'cover', backgroundPosition: 'center',
                      }}
                    />
                    <Stack spacing={1} sx={{ p: 1.25 }}>
                      <Box>
                        <Typography sx={{ fontSize: '0.85rem', wordBreak: 'break-all', lineHeight: 1.4 }}>
                          {image.imageUrl.split('/').pop()}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {image.altText}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap">
                        {isCover ? <Chip label="Cover image" size="small" color="secondary" sx={{ fontWeight: 700 }} /> : null}
                        {image.isPreview ? <Chip label="Gallery preview" size="small" variant="outlined" sx={{ fontWeight: 700 }} /> : null}
                      </Stack>
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip title={isCover ? 'Current cover' : 'Set as cover'}>
                          <IconButton
                            size="small"
                            onClick={() => handleSetCover(image)}
                            disabled={settingCover === image.id}
                            sx={{ color: isCover ? 'secondary.main' : 'text.secondary', flexShrink: 0 }}
                          >
                            {settingCover === image.id
                              ? <CircularProgress size={16} color="secondary" />
                              : isCover ? <StarRoundedIcon fontSize="small" /> : <StarBorderRoundedIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
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
                    </Stack>
                  </Box>
                );
              })}

              <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFileSelect} />
              <Box
                onClick={() => fileInputRef.current?.click()}
                sx={{
                  border: '1px dashed',
                  borderColor: selectedFiles.length ? 'secondary.main' : 'rgba(217,195,161,0.3)',
                  borderRadius: 2,
                  minHeight: 160,
                  cursor: imageFormBusy ? 'progress' : 'pointer',
                  transition: 'border-color 140ms ease, background-color 140ms ease',
                  '&:hover': imageFormBusy ? undefined : {
                    borderColor: 'rgba(217,195,161,0.6)',
                    backgroundColor: 'rgba(255,255,255,0.03)',
                  },
                }}
              >
                {selectedFiles.length > 0 ? (
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 0.5, p: 1 }}>
                    {selectedFiles.map(({ previewUrl, file }) => (
                      <Box
                        key={previewUrl}
                        sx={{ aspectRatio: '1', backgroundImage: `url(${previewUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: 1 }}
                        title={file.name}
                      />
                    ))}
                  </Box>
                ) : (
                  <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ height: '100%', minHeight: 160, px: 2, textAlign: 'center' }}>
                    <PhotoCameraRoundedIcon sx={{ fontSize: 32, color: 'text.secondary', opacity: 0.45 }} />
                    <Typography color="text.secondary" sx={{ fontSize: '0.9rem' }}>
                      Add photos
                    </Typography>
                  </Stack>
                )}
              </Box>
            </Box>
          )}
          {manageLoading ? null : manageImages.length === 0 ? (
            <Typography color="text.secondary" sx={{ mb: 2 }}>No images yet. Pick photos to add them here.</Typography>
          ) : null}

          {uploadProgress ? (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                Uploading {uploadProgress.done} / {uploadProgress.total}…
              </Typography>
              <LinearProgress variant="determinate" value={(uploadProgress.done / uploadProgress.total) * 100} color="secondary" />
            </Box>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ——— Delete event confirmation ——— */}
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

      {/* ——— Delete image confirmation ——— */}
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

      {/* ——— Delete home slideshow image confirmation ——— */}
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
