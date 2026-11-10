import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import AppFooter from './AppFooter';
import { ChevronUpIcon } from './icons';

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
 * `fullBleed` drops the page padding so the home hero can run edge to edge.
 */
function AppScrollShell({ children, fullBleed = false }) {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollContainerRef = useRef(null);

  let contentClass = 'mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-10 sm:px-8 md:py-16';
  if (fullBleed) {
    contentClass = 'flex w-full flex-1 flex-col';
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <ScrollReset scrollContainerRef={scrollContainerRef} resetScrollTopButton={setShowScrollTop} />
      <div
        ref={scrollContainerRef}
        onScroll={(event) => {
          setShowScrollTop(event.currentTarget.scrollTop > 240);
        }}
        className="warm-scrollbar flex h-0 min-h-0 w-full flex-1 flex-col overflow-x-hidden overflow-y-auto [scrollbar-gutter:stable]"
      >
        <main className={contentClass}>{children}</main>
        <AppFooter />
      </div>
      <button
        type="button"
        aria-label="Back to top"
        tabIndex={showScrollTop ? 0 : -1}
        onClick={() => scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
        className={`fixed right-5 bottom-6 z-40 grid size-12 place-items-center rounded-full border border-line-strong bg-ink-800/90 text-sand-light shadow-lg shadow-black/40 backdrop-blur transition-all duration-300 hover:bg-ink-700 sm:right-8 sm:bottom-8 ${
          showScrollTop ? 'opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
        }`}
      >
        <ChevronUpIcon />
      </button>
    </div>
  );
}

export default AppScrollShell;
