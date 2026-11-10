import { Link } from 'react-router-dom';
import BrandWordmark from './BrandWordmark';
import { navItems } from './navigation';

/**
 * Renders the site footer: wordmark, a one-line description, and the main links.
 */
function AppFooter() {
  return (
    <footer className="relative z-10 mt-auto border-t border-line">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-10 sm:px-8 md:flex-row md:items-end md:justify-between">
        <div className="grid gap-2">
          <Link to="/" className="w-fit text-lg text-sand-light">
            <BrandWordmark />
          </Link>
          <p className="text-sm text-muted">A supper club in Los Angeles. Dinner by reservation.</p>
        </div>
        <nav aria-label="Footer" className="-my-2 flex flex-wrap gap-x-6 text-sm text-muted">
          {navItems.map((item) => (
            <Link key={item.to} to={item.to} className="inline-flex min-h-11 items-center transition-colors hover:text-cream md:min-h-0">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="mx-auto w-full max-w-6xl px-5 pb-8 text-xs text-muted/70 sm:px-8">
        © {new Date().getFullYear()} 1201 Bistro · v0.2
      </div>
    </footer>
  );
}

export default AppFooter;
