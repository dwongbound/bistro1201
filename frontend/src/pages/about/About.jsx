import { Box, Grid, Typography } from '@mui/material';
import BrandWordmark from '../../common/BrandWordmark';
import PageIntro from '../../common/PageIntro';
import SurfaceCard from '../../common/SurfaceCard';

/**
 * Summarizes the hospitality and atmosphere behind the supper club.
 */
function About() {
  // Keep the about pillars inline with the page so copy edits stay close to the rendered section.
  const highlights = [
    {
      title: 'Fresh ingredients',
      copy: 'Menus shift with the season so the kitchen can spotlight produce, seafood, and meats at their best.',
    },
    {
      title: 'Warm hospitality',
      copy: 'We want reservations, arrivals, and service to feel calm, easy, and personal from start to finish.',
    },
    {
      title: 'Evening atmosphere',
      copy: 'Soft lighting, crisp pours, and a room designed for date nights, celebrations, and unhurried dinners.',
    },
  ];

  return (
    <Box sx={{ display: 'grid', gap: 4 }}>
      <PageIntro
        eyebrow="About 1201 Bistro"
        title={
          <>
            <Box component="span" sx={{ display: 'block' }}>
              About
            </Box>
            <Box component="span" sx={{ display: 'block', mt: 0.2, color: 'primary.light' }}>
              <BrandWordmark sx={{ fontSize: '1em', letterSpacing: '0.05em' }} />
            </Box>
          </>
        }
        description="Welcome to 1201 Bistro, a supper club experience built around polished comfort, seasonal ingredients, and an evening that feels intimate without ever feeling rigid."
        descriptionProps={{ variant: 'body1' }}
      />
      <Grid container spacing={3}>
        {highlights.map((item) => (
          <Grid key={item.title} size={{ xs: 12, md: 4 }}>
            <SurfaceCard cardSx={{ height: '100%' }} contentSx={{ p: { xs: 2.5, sm: 3 } }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
                {item.title}
              </Typography>
              <Typography color="text.secondary" sx={{ lineHeight: 1.7 }}>
                {item.copy}
              </Typography>
            </SurfaceCard>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

export default About;
