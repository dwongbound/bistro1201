import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded';
import { Box, Container, Fade, Fab } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import AppFooter from './AppFooter';

/**
 * Keeps route changes inside the app-level scroller so page transitions do not depend on the browser viewport.
 */
function ScrollReset({ scrollContainerRef, resetScrollTopButton }) {
  const location = useLocation();

  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    resetScrollTopButton(false);
  }, [location.pathname, resetScrollTopButton, scrollContainerRef]);

  return null;
}

/**
 * Provides one shared in-page scroll surface plus a floating return-to-top action.
 */
function AppScrollShell({ children }) {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollContainerRef = useRef(null);

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <ScrollReset scrollContainerRef={scrollContainerRef} resetScrollTopButton={setShowScrollTop} />
      <Box
        ref={scrollContainerRef}
        onScroll={(event) => {
          setShowScrollTop(event.currentTarget.scrollTop > 240);
        }}
        sx={{
          flex: 1,
          height: 0,
          minHeight: 0,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollbarGutter: 'stable',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(217, 195, 161, 0.42) rgba(255, 255, 255, 0.04)',
          '&::-webkit-scrollbar': {
            width: 10,
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(217, 195, 161, 0.42)',
            borderRadius: 999,
            border: '2px solid rgba(18, 15, 13, 0.9)',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            backgroundColor: 'rgba(234, 216, 188, 0.58)',
          },
        }}
      >
        <Container
          maxWidth="lg"
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            py: { xs: 2.5, sm: 3, md: 5 },
            px: { xs: 2, sm: 3 },
            width: '100%',
          }}
        >
          {children}
        </Container>
        <AppFooter />
      </Box>
      <Fade in={showScrollTop}>
        <Fab
          color="secondary"
          aria-label="Back to top"
          onClick={() => scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          sx={{
            position: 'fixed',
            right: { xs: 18, sm: 26 },
            bottom: { xs: 22, sm: 30 },
            zIndex: 1200,
          }}
        >
          <KeyboardArrowUpRoundedIcon />
        </Fab>
      </Fade>
    </Box>
  );
}

export default AppScrollShell;
