/**
 * Small inline SVG icons for the Tailwind pages, so public pages do not pull in an icon library.
 * Each icon inherits the current text color and is hidden from screen readers.
 */
function Svg({ className = 'size-5', children }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

/** Right-pointing arrow for forward actions. */
export function ArrowRightIcon(props) {
  return <Svg {...props}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>;
}

/** Left-pointing arrow for back links. */
export function ArrowLeftIcon(props) {
  return <Svg {...props}><path d="M19 12H5M11 6l-6 6 6 6" /></Svg>;
}

/** Two-line menu icon for the phone navigation button. */
export function MenuIcon(props) {
  return <Svg {...props}><path d="M4 8h16M4 16h16" /></Svg>;
}

/** Cross used on Close buttons. */
export function CloseIcon(props) {
  return <Svg {...props}><path d="M6 6l12 12M18 6L6 18" /></Svg>;
}

/** Upward chevron for the back-to-top button. */
export function ChevronUpIcon(props) {
  return <Svg {...props}><path d="M6 15l6-6 6 6" /></Svg>;
}

/** Plate-and-cutlery mark shown where a photo has not been uploaded yet. */
export function PlateIcon(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="3" />
      <path d="M3 4v5a2 2 0 0 0 2 2M3 4v16M21 4c-1.5 1-2 3-2 5s1 2 2 2v9" />
    </Svg>
  );
}
