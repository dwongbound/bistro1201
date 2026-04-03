import { Box } from '@mui/material';
import { useEffect, useState } from 'react';

const CYCLE_INTERVAL_MS = 5000;
const TRANSITION_MS = 1000;
const CYCLE_WORDS = ['Bistro', 'Cafe', 'After Hours'];

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

  return (
    <Box
      component="span"
      sx={{ display: 'inline-block', overflow: 'hidden', height: '1em', verticalAlign: 'bottom' }}
    >
      <Box
        component="span"
        style={{
          display: 'inline-block',
          transition: phase === 'pre-in' ? 'none' : `transform ${TRANSITION_MS}ms ease, opacity ${TRANSITION_MS}ms ease`,
          transform: phase === 'out' ? 'translateY(100%)' : phase === 'pre-in' ? 'translateY(-100%)' : 'translateY(0)',
          opacity: phase === 'in' ? 1 : 0,
        }}
      >
        {words[idx]}
      </Box>
    </Box>
  );
}

/**
 * Renders the shared 1201 Bistro wordmark with a brass-toned zero.
 * Pass `cycleSuffix` to animate through the configured suffix words.
 */
function BrandWordmark({ sx, versionSuffix = '', cycleSuffix = false }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: '0.02em',
        fontFamily: '"Montserrat", sans-serif',
        fontWeight: 800,
        letterSpacing: '0.08em',
        lineHeight: 1,
        ...sx,
      }}
    >
      <Box component="span">12</Box>
      <Box component="span" sx={{ color: 'secondary.main' }}>
        0
      </Box>
      <Box component="span">
        1{cycleSuffix ? <>{' '}<CyclingWord words={CYCLE_WORDS} /></> : versionSuffix || ''}
      </Box>
    </Box>
  );
}

export default BrandWordmark;
