import { Box } from '@mui/material';

/**
 * Renders the shared 1201 Bistro wordmark with a brass-toned zero.
 */
function BrandWordmark({ sx, versionSuffix = '' }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: '0.02em',
        fontFamily: '"Palatino Linotype", "Book Antiqua", Georgia, serif',
        fontWeight: 800,
        letterSpacing: '0.08em',
        lineHeight: 1,
        ...sx,
      }}
    >
      <Box component="span">12</Box>
      <Box component="span" sx={{ color: 'secondary.main' }}>
        0
      </Box>
      <Box component="span">1 BISTRO{versionSuffix}</Box>
    </Box>
  );
}

export default BrandWordmark;
