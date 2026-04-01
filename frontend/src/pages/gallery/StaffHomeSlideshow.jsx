import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { closestCenter, DndContext, DragOverlay, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useRef, useState } from 'react';
import SurfaceCard from '../../common/SurfaceCard';
import {
  addGalleryImage,
  createGalleryEvent,
  deleteGalleryImage,
  fetchAdminEventImages,
  updateGalleryImage,
  uploadGalleryFile,
} from './galleryAdminApi';
import { reorderHomeImages } from './galleryUtils';

/** Single draggable thumbnail inside the DndContext. */
function SortableHomeThumb({ image, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: image.id });
  return (
    <Box
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      sx={{ position: 'relative', width: 80, height: 80, flexShrink: 0, opacity: isDragging ? 0 : 1 }}
    >
      <Box
        {...listeners}
        sx={{ position: 'absolute', inset: 0, zIndex: 1, cursor: 'grab', borderRadius: 1, '&:active': { cursor: 'grabbing' } }}
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

/**
 * Manages the Home Slideshow section of Gallery Admin:
 * drag-to-reorder thumbnails, upload new photos, delete individual photos.
 * Receives apiFetch so all requests are authenticated as staff.
 */
function StaffHomeSlideshow({ apiFetch }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [activeDragId, setActiveDragId] = useState(null);
  const fileInputRef = useRef(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const loadImages = async () => {
    setLoading(true);
    try {
      const data = await fetchAdminEventImages(apiFetch, 'home');
      setImages(data);
    } catch {
      setImages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadImages();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => { selectedFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl)); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFiles]);

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

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    selectedFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    setSelectedFiles(files.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      altText: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
    })));
  };

  const handleAddImages = async (e) => {
    e.preventDefault();
    if (!selectedFiles.length) return;
    setFormBusy(true);
    setFormError('');
    setUploadProgress({ done: 0, total: selectedFiles.length });
    try {
      await ensureHomeEvent();
      for (let i = 0; i < selectedFiles.length; i++) {
        const { file, altText } = selectedFiles[i];
        const upload = await uploadGalleryFile(apiFetch, 'home', file);
        await addGalleryImage(apiFetch, 'home', {
          image_url: upload?.filename || file.name,
          alt_text: altText,
          sort_order: images.length + i,
          is_preview: false,
        });
        setUploadProgress({ done: i + 1, total: selectedFiles.length });
      }
      selectedFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl));
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadImages();
    } catch (error) {
      setFormError(error.message);
    } finally {
      setFormBusy(false);
      setUploadProgress(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog) return;
    setDeleteBusy(true);
    try {
      await deleteGalleryImage(apiFetch, 'home', deleteDialog.id);
      setDeleteDialog(null);
      await loadImages();
    } catch (error) {
      setFormError(error.message);
      setDeleteDialog(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleDragStart = ({ active }) => setActiveDragId(active.id);

  const handleDragEnd = async ({ active, over }) => {
    setActiveDragId(null);
    if (!over || active.id === over.id) return;
    const reordered = reorderHomeImages(images, active.id, over.id);
    setImages(reordered);
    try {
      await Promise.all(reordered.map((img, i) => updateGalleryImage(apiFetch, 'home', img.id, { sort_order: i })));
    } catch {
      await loadImages();
    }
  };

  return (
    <>
      <SurfaceCard contentSx={{ p: { xs: 2.5, sm: 3 } }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2.5 }}>
          <HomeRoundedIcon color="secondary" />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Home Slideshow</Typography>
            <Typography variant="caption" color="text.secondary">
              These photos cycle as the background on the home page. Drag to reorder.
            </Typography>
          </Box>
        </Stack>

        {formError ? <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert> : null}

        {loading ? (
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 2 }}>
            <CircularProgress size={16} />
            <Typography variant="caption" color="text.secondary">Loading...</Typography>
          </Stack>
        ) : images.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={images.map((img) => img.id)} strategy={rectSortingStrategy}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2.5 }}>
                {images.map((image) => (
                  <SortableHomeThumb
                    key={image.id}
                    image={image}
                    onDelete={() => setDeleteDialog(image)}
                  />
                ))}
              </Box>
            </SortableContext>
            <DragOverlay>
              {activeDragId ? (() => {
                const img = images.find((i) => i.id === activeDragId);
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

        <Stack component="form" onSubmit={handleAddImages} spacing={2}>
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
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, p: 1, backgroundColor: 'rgba(0,0,0,0.25)' }}>
                {selectedFiles.map(({ previewUrl, file }) => (
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
          {selectedFiles.length > 0 ? (
            <Typography variant="caption" color="text.secondary">
              {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
            </Typography>
          ) : null}
          {uploadProgress ? (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                Uploading {uploadProgress.done} / {uploadProgress.total}…
              </Typography>
              <LinearProgress variant="determinate" value={(uploadProgress.done / uploadProgress.total) * 100} color="secondary" />
            </Box>
          ) : null}
          <Button
            type="submit"
            variant="contained"
            disabled={formBusy || selectedFiles.length === 0}
            sx={{ alignSelf: 'flex-start' }}
          >
            {formBusy
              ? <CircularProgress size={18} color="inherit" />
              : `Add ${selectedFiles.length > 1 ? `${selectedFiles.length} Photos` : 'Photo'}`}
          </Button>
        </Stack>
      </SurfaceCard>

      <Dialog open={Boolean(deleteDialog)} onClose={() => setDeleteDialog(null)}>
        <DialogTitle>Remove from Slideshow</DialogTitle>
        <DialogContent>
          <Typography>Remove this photo from the home page slideshow?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(null)}>Cancel</Button>
          <Button color="error" onClick={handleDeleteConfirm} disabled={deleteBusy}>
            {deleteBusy ? <CircularProgress size={18} /> : 'Remove'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default StaffHomeSlideshow;
