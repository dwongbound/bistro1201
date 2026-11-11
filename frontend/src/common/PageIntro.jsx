/**
 * Renders the shared page header: a small eyebrow label, a serif title, and an optional lead paragraph.
 */
function PageIntro({ eyebrow, title, description, className = '' }) {
  return (
    <header className={`grid max-w-3xl gap-4 ${className}`}>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h1 className="font-display text-4xl leading-[1.05] font-normal tracking-tight text-cream sm:text-5xl md:text-6xl">
        {title}
      </h1>
      {description ? (
        <p className="max-w-2xl text-base leading-relaxed text-muted sm:text-lg">{description}</p>
      ) : null}
    </header>
  );
}

export default PageIntro;
