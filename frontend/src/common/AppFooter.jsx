import { Box, Container, Typography } from '@mui/material';
import BrandWordmark from './BrandWordmark';

/**
 * Renders a subtle footer shared across the application shell.
 */
function AppFooter() {
  return (
    <Box
      component="footer"
      sx={{
        borderTop: '1px solid rgba(217, 195, 161, 0.1)',
        mt: 'auto',
        py: 2.5,
      }}
    >
      <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 } }}>
        <Typography
          variant="caption"
          component="div"
          sx={{
            display: 'block',
            textAlign: 'center',
            color: 'text.secondary',
            opacity: 0.72,
          }}
        >
          <BrandWordmark versionSuffix=" v0.1" />
        </Typography>
      </Container>
    </Box>
  );
}

export default AppFooter;
