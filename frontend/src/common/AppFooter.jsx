import { Link } from 'react-router-dom';
import BrandWordmark from './BrandWordmark';
import { navItems } from './navigation';

/**
 * Renders a slim one-row site footer: wordmark and copyright on the left,
 * the main links on the right (stacked on phones).
 */
function AppFooter() {
  return (
    <footer className="relative z-10 mt-auto border-t border-line">
      {/* md:pr-24 keeps the links clear of the fixed back-to-top button. */}
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-5 py-4 sm:px-8 md:flex-row md:items-center md:justify-between md:gap-6 md:pr-24">
        <div className="flex items-baseline gap-3">
          <Link to="/" className="text-sm text-sand-light">
            <BrandWordmark />
          </Link>
          <span className="text-xs text-muted/70">© {new Date().getFullYear()} 1201</span>
        </div>
        <nav aria-label="Footer" className="-mx-2 flex flex-wrap text-sm text-muted">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="inline-flex min-h-11 items-center px-2 transition-colors hover:text-cream md:min-h-0 md:py-1"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}

export default AppFooter;
