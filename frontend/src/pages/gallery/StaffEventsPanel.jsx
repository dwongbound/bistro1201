import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CollectionsRoundedIcon from '@mui/icons-material/CollectionsRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
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
  FormControlLabel,
  IconButton,
  LinearProgress,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';
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
  uploadGalleryFile,
} from './galleryAdminApi';
import { titleToSlug } from './galleryUtils';

const EVENT_TYPES = ['Bistro', 'Cafe'];
const emptyEventForm = { title: '', date_label: '', summary: '', event_type: 'Bistro', sort_order: '' };
const emptyImageForm = { sort_order: '', is_preview: false };

/**
 * Manages the Events section of Gallery Admin:
 * list, create, inline-edit, delete, and per-event image management dialog.
 * Receives apiFetch so all requests are authenticated as staff.
 */
function StaffEventsPanel({ apiFetch }) {
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

  const [manageEvent, setManageEvent] = useState(null);
  const [manageImages, setManageImages] = useState([]);
  const [manageLoading, setManageLoading] = useState(false);
  const [imageForm, setImageForm] = useState(emptyImageForm);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [imageFormBusy, setImageFormBusy] = useState(false);
  const [imageFormError, setImageFormError] = useState('');
  const [settingCover, setSettingCover] = useState(null);
  const fileInputRef = useRef(null);

  const [deleteEventDialog, setDeleteEventDialog] = useState(null);
  const [deleteImageDialog, setDeleteImageDialog] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

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
      const data = await fetchAdminEventImages(apiFetch, slug);
      setManageImages(data);
    } catch {
      setManageImages([]);
    } finally {
      setManageLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (manageEvent) loadManageImages(manageEvent.slug);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manageEvent?.slug]);

  useEffect(() => {
    return () => { selectedFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl)); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFiles]);

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

  // ——— Manage dialog ———

  const openManage = (ev) => {
    setManageEvent(ev);
    setImageForm(emptyImageForm);
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
    setSelectedFiles(files.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      altText: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
    })));
    setImageForm(emptyImageForm);
  };

  const handleAddImage = async (e) => {
    e.preventDefault();
    if (!manageEvent || selectedFiles.length === 0) return;
    setImageFormBusy(true);
    setImageFormError('');
    setUploadProgress({ done: 0, total: selectedFiles.length });
    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const { file, altText } = selectedFiles[i];
        const upload = await uploadGalleryFile(apiFetch, manageEvent.slug, file);
        await addGalleryImage(apiFetch, manageEvent.slug, {
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

  return (
    <>
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
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ py: 1.5, px: 1 }}>
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

            {showCreateForm ? (
              <Box sx={{ pt: 2, px: 1, pb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>New Event</Typography>
                <Stack component="form" noValidate onSubmit={handleCreateEvent} spacing={2}>
                  <TextField
                    label="Title"
                    value={eventForm.title}
                    onChange={(e) => {
                      createFormErrors.clearError('title');
                      setEventForm((f) => ({ ...f, title: e.target.value }));
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
                  <TextField
                    label="Sort Order"
                    value={eventForm.sort_order}
                    onChange={(e) => setEventForm((f) => ({ ...f, sort_order: e.target.value }))}
                    size="small"
                    type="number"
                    sx={{ width: 160 }}
                  />
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
              <Box
                data-testid="add-event-trigger"
                onClick={() => setShowCreateForm(true)}
                sx={{
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

      {/* Manage images dialog */}
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

          {manageLoading ? (
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 3 }}>
              <CircularProgress size={18} />
              <Typography color="text.secondary">Loading images...</Typography>
            </Stack>
          ) : manageImages.length === 0 ? (
            <Typography color="text.secondary" sx={{ mb: 2 }}>No images yet — add some below.</Typography>
          ) : (
            <Stack divider={<Divider sx={{ borderColor: 'rgba(217,195,161,0.08)' }} />} sx={{ mb: 2.5 }}>
              {manageImages.map((image) => {
                const isCover = manageEvent && image.imageUrl === manageEvent.coverImage;
                return (
                  <Stack key={`${image.id}-${image.imageUrl}`} direction="row" alignItems="center" spacing={1.5} sx={{ py: 1.5 }}>
                    <Box
                      sx={{
                        width: 52, height: 52, borderRadius: 1, flexShrink: 0,
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        backgroundImage: image.imageUrl ? `url(${image.imageUrl})` : 'none',
                        backgroundSize: 'cover', backgroundPosition: 'center',
                        border: isCover ? '2px solid' : '1px solid',
                        borderColor: isCover ? 'secondary.main' : 'rgba(217,195,161,0.12)',
                      }}
                    />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={{ fontSize: '0.85rem', wordBreak: 'break-all', lineHeight: 1.4 }}>
                        {image.imageUrl.split('/').pop()}
                      </Typography>
                      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.25 }}>
                        <Typography variant="caption" color="text.secondary">{image.altText}</Typography>
                        {isCover ? <Chip label="cover" size="small" color="secondary" sx={{ height: 18, fontSize: '0.7rem' }} /> : null}
                      </Stack>
                    </Box>
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
                      <IconButton size="small" onClick={() => setDeleteImageDialog(image)} sx={{ color: 'text.secondary', flexShrink: 0 }}>
                        <DeleteRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                );
              })}
            </Stack>
          )}

          <Divider sx={{ borderColor: 'rgba(217,195,161,0.1)', mb: 2 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>Add Photos</Typography>
          <Stack component="form" onSubmit={handleAddImage} spacing={2}>
            <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFileSelect} />
            <Box
              onClick={() => fileInputRef.current?.click()}
              sx={{
                border: '1px dashed',
                borderColor: selectedFiles.length ? 'secondary.main' : 'rgba(217,195,161,0.3)',
                borderRadius: 2, overflow: 'hidden', cursor: 'pointer',
                transition: 'border-color 140ms ease',
                '&:hover': { borderColor: 'rgba(217,195,161,0.6)' },
              }}
            >
              {selectedFiles.length > 0 ? (
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 0.5, p: 1, backgroundColor: 'rgba(0,0,0,0.25)' }}>
                  {selectedFiles.map(({ previewUrl, file }) => (
                    <Box key={previewUrl} sx={{ aspectRatio: '1', backgroundImage: `url(${previewUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: 1 }} title={file.name} />
                  ))}
                </Box>
              ) : (
                <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ py: 4 }}>
                  <PhotoCameraRoundedIcon sx={{ fontSize: 32, color: 'text.secondary', opacity: 0.45 }} />
                  <Typography color="text.secondary" sx={{ fontSize: '0.9rem' }}>Add photos</Typography>
                </Stack>
              )}
            </Box>
            {selectedFiles.length > 0 ? (
              <Typography variant="caption" color="text.secondary">
                {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
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
                label="Preview on gallery index"
              />
            </Stack>
            {uploadProgress ? (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                  Uploading {uploadProgress.done} / {uploadProgress.total}…
                </Typography>
                <LinearProgress variant="determinate" value={(uploadProgress.done / uploadProgress.total) * 100} color="secondary" />
              </Box>
            ) : null}
            <Button type="submit" variant="contained" disabled={imageFormBusy || selectedFiles.length === 0} sx={{ alignSelf: 'flex-start' }}>
              {imageFormBusy ? <CircularProgress size={20} color="inherit" /> : `Add ${selectedFiles.length > 1 ? `${selectedFiles.length} Photos` : 'Photo'}`}
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>

      {/* Delete event confirmation */}
      <Dialog open={Boolean(deleteEventDialog)} onClose={() => setDeleteEventDialog(null)}>
        <DialogTitle>Delete Event</DialogTitle>
        <DialogContent>
          <Typography>Delete <strong>{deleteEventDialog?.title}</strong> and all its images? This cannot be undone.</Typography>
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
    </>
  );
}

export default StaffEventsPanel;
