/**
 * Applies one shared fade-and-rise transition whenever the wrapped route key changes.
 */
function PageTransition({ children, routeKey }) {
  return (
    <div key={routeKey} className="animate-page-in">
      {children}
    </div>
  );
}

export default PageTransition;
