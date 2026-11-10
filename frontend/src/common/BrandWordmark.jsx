import { useEffect, useState } from 'react';

const CYCLE_INTERVAL_MS = 5000;
const TRANSITION_MS = 1000;
const CYCLE_WORDS = ['Bistro', 'Cafe', 'After Hours'];

/**
 * Rotates through the 1201 concepts with a short slide-and-fade between words.
 */
function CyclingWord({ words }) {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState('in'); // 'in' | 'out' | 'pre-in'

  useEffect(() => {
    let timeoutId;
    const intervalId = setInterval(() => {
      setPhase('out');
      timeoutId = setTimeout(() => {
        setIdx((i) => (i + 1) % words.length);
        setPhase('pre-in');
        // Two frames so the browser paints the "above" position before sliding in.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setPhase('in'));
        });
      }, TRANSITION_MS);
    }, CYCLE_INTERVAL_MS);
    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [words.length]);

  let transform = 'translateY(0)';
  if (phase === 'out') transform = 'translateY(100%)';
  if (phase === 'pre-in') transform = 'translateY(-100%)';

  return (
    <span className="inline-block h-[1.1em] overflow-hidden align-bottom">
      <span
        className="inline-block"
        style={{
          transition: phase === 'pre-in' ? 'none' : `transform ${TRANSITION_MS}ms ease, opacity ${TRANSITION_MS}ms ease`,
          transform,
          opacity: phase === 'in' ? 1 : 0,
        }}
      >
        {words[idx]}
      </span>
    </span>
  );
}

/**
 * Renders the shared 1201 wordmark with a brass-toned zero.
 * Pass `cycleSuffix` to animate through the 1201 concepts, or `versionSuffix` for static text.
 */
function BrandWordmark({ className = '', versionSuffix = '', cycleSuffix = false }) {
  return (
    <span className={`inline-flex items-baseline gap-[0.02em] font-brand leading-none font-extrabold tracking-[0.08em] ${className}`}>
      <span>12</span>
      <span className="text-brass">0</span>
      <span>
        1{cycleSuffix ? <>{' '}<CyclingWord words={CYCLE_WORDS} /></> : versionSuffix}
      </span>
    </span>
  );
}

export default BrandWordmark;
