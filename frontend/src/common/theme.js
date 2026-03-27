import { createTheme } from '@mui/material';

/**
 * Centralizes the Material UI theme so page files do not repeat palette and component styling.
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
      default: '#120f0d',
      paper: '#1b1612',
    },
    text: {
      primary: '#f3eadc',
      secondary: '#c4b6a3',
    },
  },
  shape: {
    borderRadius: 18,
  },
  typography: {
    fontFamily: '"Palatino Linotype", "Book Antiqua", Georgia, serif',
    h2: {
      fontSize: 'clamp(2.75rem, 7vw, 4.75rem)',
    },
    h3: {
      fontSize: 'clamp(2rem, 5vw, 3rem)',
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
          fontWeight: 700,
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
          backgroundImage: 'linear-gradient(180deg, rgba(38, 31, 26, 0.96), rgba(22, 18, 15, 0.98))',
          border: '1px solid rgba(217, 195, 161, 0.12)',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.22)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
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
  },
});
