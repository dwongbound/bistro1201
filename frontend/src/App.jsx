import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import {
  AppBar,
  Box,
  Button,
  CssBaseline,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  ThemeProvider,
  Toolbar,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { BrowserRouter as Router, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import AppScrollShell from './common/AppScrollShell';
import BrandWordmark from './common/BrandWordmark';
import PageTransition from './common/PageTransition';
import { navItems } from './common/navigation';
import { appTheme } from './common/theme';
import Home from './pages/home/Home';
import About from './pages/about/About';
import Team from './pages/team/Team';
import Gallery from './pages/gallery/Gallery';
import GalleryEventDetail from './pages/gallery/GalleryEventDetail';
import Scheduling from './pages/reserve/Scheduling';
import StaffGallery from './pages/gallery/StaffGallery';

/**
 * Keeps route selection in the shell while delegating transition visuals to a shared component.
 */
function AppRoutes() {
  const location = useLocation();
  const isHomeRoute = location.pathname === '/';

  const routes = (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/team" element={<Team />} />
      <Route path="/gallery" element={<Gallery />} />
      <Route path="/gallery/:eventSlug" element={<GalleryEventDetail />} />
      <Route path="/pictures" element={<Gallery />} />
      <Route path="/scheduling" element={<Scheduling />} />
      <Route path="/reserve" element={<Scheduling />} />
      <Route path="/staff/gallery" element={<StaffGallery />} />
    </Routes>
  );

  if (isHomeRoute) {
    return routes;
  }

  return (
    <PageTransition routeKey={location.pathname}>
      {routes}
    </PageTransition>
  );
}

/**
 * Renders the top-level shell, including navigation and route switching.
 */
function AppShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  /**
   * Closes the mobile drawer after route changes or backdrop taps.
   */
  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <Router>
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <AppBar position="sticky" color="transparent" elevation={0} sx={{ backdropFilter: 'blur(14px)' }}>
          <Toolbar sx={{ justifyContent: 'space-between', gap: 2, px: { xs: 2, md: 4 } }}>
            <Typography
              variant="h6"
              component={NavLink}
              to="/"
              sx={{
                color: 'primary.light',
                fontSize: { xs: '1rem', sm: '1.15rem' },
                textDecoration: 'none',
              }}
            >
              <BrandWordmark />
            </Typography>
            <IconButton
              color="inherit"
              aria-label="Open navigation menu"
              onClick={() => setMobileMenuOpen(true)}
              edge="end"
              sx={{ display: { xs: 'inline-flex', md: 'none' } }}
            >
              <MenuRoundedIcon />
            </IconButton>
            <Stack
              direction="row"
              spacing={0}
              sx={{
                display: { xs: 'none', md: 'flex' },
                justifyContent: 'flex-end',
                alignSelf: 'stretch',
                minHeight: '100%',
              }}
            >
              {navItems.map((item, index) => (
                <Box
                  key={item.to}
                  sx={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'stretch',
                    '&::before': index === 0 ? undefined : {
                      content: '"|"',
                      position: 'absolute',
                      left: 0,
                      top: '50%',
                      transform: 'translateY(-52%)',
                      color: 'rgba(217, 195, 161, 0.35)',
                      fontSize: '0.95rem',
                      lineHeight: 1,
                      pointerEvents: 'none',
                    },
                  }}
                >
                  <Button
                    component={NavLink}
                    to={item.to}
                    end={item.to === '/'}
                    disableRipple
                    sx={{
                      color: 'text.primary',
                      borderRadius: 0,
                      px: 2.75,
                      minWidth: 0,
                      minHeight: '100%',
                      alignSelf: 'stretch',
                      border: 'none',
                      textDecoration: 'none',
                      fontWeight: 700,
                      '&:hover': {
                        backgroundColor: 'transparent',
                        textDecoration: 'underline',
                        textDecorationColor: 'rgba(217, 195, 161, 0.55)',
                        textDecorationThickness: '1px',
                        textUnderlineOffset: '0.35em',
                      },
                      '&:active': {
                        backgroundColor: 'transparent',
                      },
                      '&:focus-visible': {
                        backgroundColor: 'transparent',
                      },
                      '&.active': {
                        color: 'primary.light',
                        textDecoration: 'underline',
                        textDecorationColor: 'rgba(217, 195, 161, 0.9)',
                        textDecorationThickness: '1px',
                        textUnderlineOffset: '0.35em',
                      },
                    }}
                  >
                    {item.label}
                  </Button>
                </Box>
              ))}
            </Stack>
          </Toolbar>
        </AppBar>
        <Drawer
          anchor="right"
          open={mobileMenuOpen}
          onClose={closeMobileMenu}
          slotProps={{
            paper: {
              sx: {
                width: 280,
                px: 1,
                py: 2,
                bgcolor: 'background.paper',
                backgroundImage: 'linear-gradient(180deg, rgba(34, 28, 24, 0.98), rgba(19, 16, 13, 0.98))',
              },
            },
          }}
        >
          <Typography
            component={NavLink}
            to="/"
            onClick={closeMobileMenu}
            sx={{ px: 2, pb: 1.5, color: 'primary.light', textDecoration: 'none', display: 'block' }}
          >
            <BrandWordmark />
          </Typography>
          <List sx={{ display: 'grid', gap: 1 }}>
            {navItems.map((item) => (
              <ListItemButton
                key={item.to}
                component={NavLink}
                to={item.to}
                end={item.to === '/'}
                onClick={closeMobileMenu}
                sx={{
                  borderRadius: 3,
                  '&.active': {
                    bgcolor: 'rgba(176, 122, 68, 0.2)',
                    color: 'primary.light',
                  },
                }}
              >
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}
          </List>
        </Drawer>
        <AppScrollShell>
          <AppRoutes />
        </AppScrollShell>
      </Box>
    </Router>
  );
}

/**
 * Wraps the routed application in the global MUI providers.
 */
function App() {
  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <AppShell />
    </ThemeProvider>
  );
}

export default App;
