import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { Alert, Box, Button, CardMedia, Chip, CircularProgress, Grid, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import PageIntro from '../../common/PageIntro';
import SurfaceCard from '../../common/SurfaceCard';
import { fetchGalleryEvent } from './galleryApi';

/**
 * Renders the full image gallery for a single event selected from the Gallery index.
 */
function GalleryEventDetail() {
  const { eventSlug } = useParams();
  const [event, setEvent] = useState(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [eventError, setEventError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadEvent() {
      if (!eventSlug) {
        setEvent(null);
        setLoadingEvent(false);
        setEventError('That event gallery is not available right now.');
        return;
      }

      setLoadingEvent(true);
      setEventError('');

      try {
        const nextEvent = await fetchGalleryEvent(eventSlug);
        if (active) {
          setEvent(nextEvent);
        }
      } catch (error) {
        console.error(`Error loading gallery event "${eventSlug}":`, error);
        if (active) {
          setEvent(null);
          setEventError(error.message || 'That event gallery is not available right now.');
        }
      } finally {
        if (active) {
          setLoadingEvent(false);
        }
      }
    }

    loadEvent();

    return () => {
      active = false;
    };
  }, [eventSlug]);

  if (loadingEvent) {
    return (
      <Box sx={{ display: 'grid', gap: 3 }}>
        <PageIntro
          eyebrow="Gallery"
          title="Loading Event Gallery"
          description="Pulling the latest event photos from the backend."
        />
        <SurfaceCard>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <CircularProgress size={20} color="secondary" />
            <Typography color="text.secondary">Loading event gallery...</Typography>
          </Stack>
        </SurfaceCard>
      </Box>
    );
  }

  if (!event) {
    return (
      <Box sx={{ display: 'grid', gap: 3 }}>
        <PageIntro
          eyebrow="Gallery"
          title="Event Not Found"
          description={eventError || 'That event gallery is not available right now.'}
        />
        <Alert severity="warning">Try returning to the Gallery index to choose another event.</Alert>
        <Button
          component={RouterLink}
          to="/gallery"
          variant="outlined"
          startIcon={<ArrowBackRoundedIcon />}
          sx={{ width: 'fit-content' }}
        >
          Back to Gallery
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'grid', gap: 3 }}>
      <PageIntro
        eyebrow="Gallery"
        title={event.title}
        description={event.summary}
        descriptionProps={{ sx: { maxWidth: 760 } }}
      />
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Chip label="Event Gallery" color="secondary" sx={{ width: 'fit-content', fontWeight: 700 }} />
        <Chip label={event.dateLabel} variant="outlined" sx={{ width: 'fit-content' }} />
      </Stack>
      <Button
        component={RouterLink}
        to="/gallery"
        variant="outlined"
        startIcon={<ArrowBackRoundedIcon />}
        sx={{ width: 'fit-content' }}
      >
        Back to Gallery
      </Button>
      <Grid container spacing={3}>
        {event.galleryImages.map((image) => (
          <Grid key={image.alt} size={{ xs: 12, sm: 6 }}>
            <SurfaceCard cardSx={{ overflow: 'hidden' }} contentSx={{ p: 0 }}>
              <CardMedia component="img" image={image.src} alt={image.alt} sx={{ height: { xs: 260, sm: 320 } }} />
            </SurfaceCard>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

export default GalleryEventDetail;
