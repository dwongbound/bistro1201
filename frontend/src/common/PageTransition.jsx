import { Box } from '@mui/material';

/**
 * Applies one shared fade-and-rise transition whenever the wrapped route key changes.
 */
function PageTransition({ children, routeKey }) {
  return (
    <Box
      key={routeKey}
      sx={{
        animation: 'pageFadeIn 700ms ease',
        '@keyframes pageFadeIn': {
          from: {
            opacity: 0,
            transform: 'translateY(10px)',
          },
          to: {
            opacity: 1,
            transform: 'translateY(0)',
          },
        },
      }}
    >
      {children}
    </Box>
  );
}

export default PageTransition;
