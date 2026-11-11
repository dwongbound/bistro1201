import { createTheme } from '@mui/material';

/**
 * Single place to adjust the global corner roundness.
 * MUI uses this as the base unit — individual components scale from it.
 */
export const BORDER_RADIUS = 12;

/**
 * Corner roundness for pill-style chips and listed time buttons.
 */
export const CHIP_BORDER_RADIUS = 24;

/**
 * Corner roundness for actionable buttons.
 */
export const BUTTON_BORDER_RADIUS = 999;

// Same fonts as the Tailwind tokens in index.css, so MUI pages match the redesign.
const SANS_FONT = '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
const DISPLAY_FONT = '"Fraunces", "Iowan Old Style", Georgia, serif';

/**
 * Centralizes the Material UI theme for the reserve and staff pages, which have not moved to Tailwind yet.
 */
export const appTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#d9c3a1',
      light: '#ead8bc',
    },
    secondary: {
      main: '#b07a44',
    },
    background: {
      default: '#0e0b09',
      paper: '#1d1814',
    },
    text: {
      primary: '#f3eadc',
      secondary: '#c4b6a3',
    },
  },
  shape: {
    borderRadius: BORDER_RADIUS,
  },
  typography: {
    fontFamily: SANS_FONT,
    h2: {
      fontFamily: DISPLAY_FONT,
      fontSize: 'clamp(2.75rem, 7vw, 4.75rem)',
    },
    h3: {
      fontFamily: DISPLAY_FONT,
      fontWeight: 400,
      fontSize: 'clamp(2rem, 5vw, 3rem)',
    },
    h4: {
      fontFamily: DISPLAY_FONT,
    },
    h5: {
      fontFamily: DISPLAY_FONT,
    },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(18, 15, 13, 0.72)',
          borderBottom: '1px solid rgba(217, 195, 161, 0.14)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: `${BUTTON_BORDER_RADIUS}px`,
        },
        contained: {
          color: '#120f0d',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        outlined: {
          borderColor: 'rgba(217, 195, 161, 0.3)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          // Matches the Tailwind .panel surface in index.css.
          backgroundImage: 'linear-gradient(180deg, rgba(29, 24, 20, 0.9), rgba(21, 17, 14, 0.9))',
          border: '1px solid rgba(217, 195, 161, 0.14)',
          boxShadow: 'none',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: `${CHIP_BORDER_RADIUS}px`,
        },
        outlined: {
          borderColor: 'rgba(217, 195, 161, 0.28)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: '#c4b6a3',
          '&.Mui-error': {
            color: '#c4b6a3',
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          color: '#f3eadc',
          // Same shape and fill as the Tailwind FormField inputs.
          borderRadius: 12,
          backgroundColor: 'rgba(14, 11, 9, 0.6)',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(217, 195, 161, 0.28)',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(217, 195, 161, 0.42)',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#d9c3a1',
          },
          '&.Mui-error': {
            color: '#f3eadc',
          },
          '&.Mui-error .MuiOutlinedInput-notchedOutline': {
            borderColor: '#ff4d3a',
          },
          '&.Mui-error:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#ff6a59',
          },
          '&.Mui-error.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#ff6a59',
          },
          '&.Mui-error .MuiOutlinedInput-input': {
            color: '#f3eadc',
          },
        },
      },
    },
  },
});
