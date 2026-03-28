import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { Alert, Box, Button, Chip, Grid, Skeleton, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import FadeInImage from '../../common/FadeInImage';
import PageIntro from '../../common/PageIntro';
import SurfaceCard from '../../common/SurfaceCard';
import { fetchGalleryEvents } from './galleryApi';

const galleryLoadingPlaceholders = Array.from({ length: 3 }, (_, index) => ({
  id: `gallery-loading-${index}`,
}));

/**
 * Presents the event-based Gallery index with preview photography for each evening.
 */
function Gallery() {
  const [galleryEvents, setGalleryEvents] = useState([]);
  const [loadingGallery, setLoadingGallery] = useState(true);
  const [galleryError, setGalleryError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadGallery() {
      setLoadingGallery(true);
      setGalleryError('');

      try {
        const events = await fetchGalleryEvents();
        if (active) {
          setGalleryEvents(events);
        }
      } catch (error) {
        console.error('Error loading gallery events:', error);
        if (active) {
          setGalleryError(error.message || 'Unable to load the gallery right now.');
        }
      } finally {
        if (active) {
          setLoadingGallery(false);
        }
      }
    }

    loadGallery();

    return () => {
      active = false;
    };
  }, []);

  return (
    <Box sx={{ display: 'grid', gap: 3 }}>
      <PageIntro
        eyebrow="Photos"
        title="Event Gallery"
        description="Browse past evenings, preview a few moments from each event, and open the full photo set for a closer look."
        descriptionProps={{ sx: { maxWidth: 760 } }}
      />
      {galleryError ? <Alert severity="error">{galleryError}</Alert> : null}
      {!loadingGallery && !galleryError && galleryEvents.length === 0 ? (
        <Alert severity="info">No gallery events have been published yet. Add event metadata in Postgres when you are ready.</Alert>
      ) : null}
      {loadingGallery ? (
        <Grid container spacing={3}>
          {galleryLoadingPlaceholders.map((placeholder) => (
            <Grid key={placeholder.id} size={{ xs: 12 }}>
              <SurfaceCard cardSx={{ overflow: 'hidden' }} contentSx={{ p: 0 }}>
                <Grid container>
                  <Grid size={{ xs: 12, md: 5 }}>
                    <Skeleton
                      variant="rectangular"
                      animation="wave"
                      sx={{
                        minHeight: 320,
                        height: '100%',
                        bgcolor: 'rgba(255, 255, 255, 0.08)',
                        transform: 'none',
                      }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 7 }}>
                    <Box sx={{ p: { xs: 2.5, sm: 3 } }}>
                      <Stack spacing={2.5}>
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                          <Skeleton
                            variant="rounded"
                            animation="wave"
                            sx={{ width: 80, height: 32, borderRadius: 999, bgcolor: 'rgba(255, 255, 255, 0.08)' }}
                          />
                          <Skeleton
                            variant="rounded"
                            animation="wave"
                            sx={{ width: 116, height: 32, borderRadius: 999, bgcolor: 'rgba(255, 255, 255, 0.06)' }}
                          />
                        </Stack>
                        <Box>
                          <Skeleton
                            variant="text"
                            animation="wave"
                            sx={{ fontSize: '2.2rem', width: '62%', bgcolor: 'rgba(255, 255, 255, 0.08)' }}
                          />
                          <Skeleton
                            variant="text"
                            animation="wave"
                            sx={{ fontSize: '1rem', width: '96%', bgcolor: 'rgba(255, 255, 255, 0.05)' }}
                          />
                          <Skeleton
                            variant="text"
                            animation="wave"
                            sx={{ fontSize: '1rem', width: '88%', bgcolor: 'rgba(255, 255, 255, 0.05)' }}
                          />
                          <Skeleton
                            variant="text"
                            animation="wave"
                            sx={{ fontSize: '1rem', width: '72%', bgcolor: 'rgba(255, 255, 255, 0.05)' }}
                          />
                        </Box>
                        <Grid container spacing={2}>
                          {Array.from({ length: 2 }, (_, imageIndex) => (
                            <Grid key={`${placeholder.id}-preview-${imageIndex}`} size={{ xs: 12, sm: 6 }}>
                              <SurfaceCard cardSx={{ overflow: 'hidden' }} contentSx={{ p: 0 }}>
                                <Skeleton
                                  variant="rectangular"
                                  animation="wave"
                                  sx={{ height: 180, bgcolor: 'rgba(255, 255, 255, 0.07)', transform: 'none' }}
                                />
                              </SurfaceCard>
                            </Grid>
                          ))}
                        </Grid>
                        <Skeleton
                          variant="rounded"
                          animation="wave"
                          sx={{ width: 172, height: 40, borderRadius: 999, bgcolor: 'rgba(255, 255, 255, 0.08)' }}
                        />
                      </Stack>
                    </Box>
                  </Grid>
                </Grid>
              </SurfaceCard>
            </Grid>
          ))}
        </Grid>
      ) : null}
      {!loadingGallery && !galleryError ? (
        <Grid container spacing={3}>
          {galleryEvents.map((event) => (
            <Grid key={event.slug} size={{ xs: 12 }}>
              <SurfaceCard cardSx={{ overflow: 'hidden' }} contentSx={{ p: 0 }}>
                <Grid container>
                  <Grid size={{ xs: 12, md: 6 }} sx={{ position: 'relative', minHeight: 280 }}>
                    <FadeInImage
                      src={event.coverImage}
                      alt={event.title}
                      sx={{ position: 'absolute', inset: 0 }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Box sx={{ p: { xs: 2.5, sm: 3 } }}>
                      <Stack spacing={2.5}>
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                          <Chip label={event.eventType} color="secondary" sx={{ width: 'fit-content', fontWeight: 700 }} />
                          <Chip label={event.dateLabel} variant="outlined" sx={{ width: 'fit-content' }} />
                        </Stack>
                        <Box>
                          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                            {event.title}
                          </Typography>
                          <Typography color="text.secondary" sx={{ maxWidth: 620, lineHeight: 1.8 }}>
                            {event.summary}
                          </Typography>
                        </Box>
                        <Grid container spacing={2}>
                          {event.previewImages.map((image) => (
                            <Grid key={`${event.slug}-${image.src}`} size={{ xs: 12, sm: 6 }}>
                              <SurfaceCard cardSx={{ overflow: 'hidden' }} contentSx={{ p: 0 }}>
                                <FadeInImage src={image.src} alt={image.alt} sx={{ aspectRatio: '4/3' }} />
                              </SurfaceCard>
                            </Grid>
                          ))}
                        </Grid>
                        <Button
                          component={RouterLink}
                          to={`/gallery/${event.slug}`}
                          variant="outlined"
                          endIcon={<ArrowForwardRoundedIcon />}
                          sx={{ width: 'fit-content' }}
                        >
                          View Event Gallery
                        </Button>
                      </Stack>
                    </Box>
                  </Grid>
                </Grid>
              </SurfaceCard>
            </Grid>
          ))}
        </Grid>
      ) : null}
    </Box>
  );
}

export default Gallery;
