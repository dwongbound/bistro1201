import EastRoundedIcon from '@mui/icons-material/EastRounded';
import { Box, Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import BrandWordmark from '../../common/BrandWordmark';

/**
 * Shows the landing-page hero and the primary calls to action.
 */
function Home() {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 3,
        py: { xs: 4, md: 8 },
        minHeight: { md: '70vh' },
        alignContent: 'center',
      }}
    >
      <Box
        sx={{
          width: '50%',
          height: '1px',
          backgroundColor: 'rgba(217, 195, 161, 0.55)',
          display: 'block',
          flexShrink: 0,
        }}
      />
      <Typography
        component="h1"
        variant="h2"
        sx={{
          maxWidth: 760,
          fontWeight: 800,
          letterSpacing: '-0.04em',
        }}
      >
        <Box component="span" sx={{ display: 'block' }}>
          Welcome to
        </Box>
        <Box component="span" sx={{ display: 'block', mt: 0.2, color: 'primary.light' }}>
          <BrandWordmark sx={{ fontSize: '1em', letterSpacing: '0.05em' }} />
        </Box>
      </Typography>
      <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 640, lineHeight: 1.7 }}>
        An intimate supper club experience with refined plates, thoughtful pours, and an easy way
        to reserve your next evening.
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <Button component={RouterLink} to="/reserve" variant="contained" size="large" endIcon={<EastRoundedIcon />}>
          Reserve
        </Button>
        <Button component={RouterLink} to="/gallery" variant="outlined" size="large">
          View Gallery
        </Button>
      </Stack>
    </Box>
  );
}

export default Home;
