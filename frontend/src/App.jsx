import { ThemeProvider } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { BrowserRouter as Router, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import AppScrollShell from './common/AppScrollShell';
import BrandWordmark from './common/BrandWordmark';
import PageTransition from './common/PageTransition';
import { CloseIcon, MenuIcon } from './common/icons';
import { navItems } from './common/navigation';
import { appTheme } from './common/theme';
import Home from './pages/home/Home';
import About from './pages/about/About';
import Team from './pages/team/Team';
import Gallery from './pages/gallery/Gallery';
import GalleryEventDetail from './pages/gallery/GalleryEventDetail';
import Scheduling from './pages/reserve/Scheduling';
import StaffGallery from './pages/gallery/StaffGallery';
import StaffWaitlist from './pages/reserve/StaffWaitlist';

// Reserve gets its own pill button in the header, so the plain links leave it out.
const headerLinks = navItems.filter((item) => item.to !== '/reserve');

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
      <Route path="/staff/waitlist" element={<StaffWaitlist />} />
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
 * Returns the class list for a desktop header link, highlighting the active route.
 */
function headerLinkClass({ isActive }) {
  const base = 'relative py-2 text-sm font-medium tracking-wide transition-colors after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:bg-sand after:transition-transform after:duration-300';
  if (isActive) {
    return `${base} text-sand-light after:scale-x-100`;
  }
  return `${base} text-cream/80 hover:text-cream after:scale-x-0 hover:after:scale-x-100`;
}

/**
 * Full-screen phone menu. The rest of the page is made inert while it is open
 * so screen readers and tests only see the menu links.
 */
function MobileMenu({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Navigation menu"
      className="fixed inset-0 z-50 flex animate-fade-in flex-col bg-ink-950/95 backdrop-blur-xl md:hidden"
    >
      <div className="flex h-16 items-center justify-between px-5">
        <NavLink to="/" onClick={onClose} className="text-lg text-sand-light">
          <BrandWordmark />
        </NavLink>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close navigation menu"
          className="-mr-2 inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-medium text-cream"
        >
          Close
          <CloseIcon className="size-[18px]" />
        </button>
      </div>
      <nav aria-label="Primary" className="flex flex-1 flex-col justify-center gap-1 px-6 pb-24">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={onClose}
            className={({ isActive }) =>
              `font-display py-3 text-4xl tracking-tight transition-colors ${isActive ? 'text-sand-light' : 'text-cream/70 hover:text-cream'}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/**
 * Renders the top-level shell, including navigation and route switching.
 */
function AppShell() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isHomeRoute = location.pathname === '/';

  /**
   * Closes the phone menu after a link tap, Escape, or the Close button.
   */
  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const headerRef = useRef(null);
  const contentRef = useRef(null);

  // React 18 does not pass `inert` through as a prop, so set it on the DOM directly.
  // aria-hidden as well, for assistive tech and test tools that ignore inert.
  useEffect(() => {
    [headerRef.current, contentRef.current].forEach((node) => {
      if (!node) return;
      if (mobileMenuOpen) {
        node.setAttribute('inert', '');
        node.setAttribute('aria-hidden', 'true');
      } else {
        node.removeAttribute('inert');
        node.removeAttribute('aria-hidden');
      }
    });
  }, [mobileMenuOpen]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header
        ref={headerRef}
        className="relative z-30 border-b border-line bg-ink-950/70 backdrop-blur-md"
      >
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <NavLink to="/" aria-label="1201 Bistro home" className="text-lg text-sand-light sm:text-xl">
            <BrandWordmark />
          </NavLink>
          <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
            {headerLinks.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} className={headerLinkClass}>
                {item.label}
              </NavLink>
            ))}
            <NavLink to="/reserve" className="btn btn-primary min-h-10 px-5">
              Reserve
            </NavLink>
          </nav>
          <button
            type="button"
            aria-label="Open navigation menu"
            onClick={() => setMobileMenuOpen(true)}
            className="-mr-2 grid size-11 place-items-center rounded-full text-cream md:hidden"
          >
            <MenuIcon className="size-6" />
          </button>
        </div>
      </header>
      <MobileMenu open={mobileMenuOpen} onClose={closeMobileMenu} />
      <div ref={contentRef} className="flex min-h-0 flex-1 flex-col">
        <AppScrollShell fullBleed={isHomeRoute}>
          <AppRoutes />
        </AppScrollShell>
      </div>
    </div>
  );
}

/**
 * Wraps the routed application. The MUI theme stays for the reserve and staff
 * pages until they move to Tailwind too.
 */
function App() {
  return (
    <ThemeProvider theme={appTheme}>
      <Router>
        <AppShell />
      </Router>
    </ThemeProvider>
  );
}

export default App;
