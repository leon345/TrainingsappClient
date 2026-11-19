import '@fontsource-variable/roboto';
import { createTheme, type PaletteOptions, type Theme } from '@mui/material/styles';
import { STANDARD_FARBSCHEMA, type Farbpalette, type Farbschema } from './farbschema';

export const SCHRIFTART = "'Roboto Variable', 'Roboto', system-ui, -apple-system, sans-serif";

function zuMuiPalette(modus: 'light' | 'dark', p: Farbpalette): PaletteOptions {
  return {
    mode: modus,
    primary: {
      main: p.primary,
      contrastText: p.onPrimary,
      light: p.primaryContainer,
      dark: p.onPrimaryContainer,
    },
    secondary: {
      main: p.secondary,
      contrastText: p.onSecondary,
      light: p.secondaryContainer,
      dark: p.onSecondaryContainer,
    },
    info: {
      main: p.tertiary,
      contrastText: p.onTertiary,
      light: p.tertiaryContainer,
      dark: p.onTertiaryContainer,
    },
    error: {
      main: p.error,
      contrastText: p.onError,
      light: p.errorContainer,
      dark: p.onErrorContainer,
    },
    background: {
      default: p.surface,
      paper: p.surfaceContainerLow,
    },
    text: {
      primary: p.onSurface,
      secondary: p.onSurfaceVariant,
    },
    divider: p.outlineVariant,
  };
}

export function erzeugeAppTheme(farbschema: Farbschema = STANDARD_FARBSCHEMA): Theme {
  return createTheme({
    cssVariables: {
      colorSchemeSelector: 'media',
    },
    colorSchemes: {
      light: {
        palette: zuMuiPalette('light', farbschema.hell),
      },
      dark: {
        palette: zuMuiPalette('dark', farbschema.dunkel),
      },
    },
    breakpoints: {
      values: {
        xs: 0,
        sm: 600,
        md: 840,
        lg: 1200,
        xl: 1536,
      },
    },
    shape: {
      borderRadius: 20,
    },
    typography: {
      fontFamily: SCHRIFTART,
      h1: {
        fontSize: '2.25rem',
        fontWeight: 700,
        lineHeight: 1.15,
        letterSpacing: '-0.02em',
      },
      h2: {
        fontSize: '1.75rem',
        fontWeight: 700,
        lineHeight: 1.2,
        letterSpacing: '-0.015em',
      },
      h3: {
        fontSize: '1.375rem',
        fontWeight: 600,
        lineHeight: 1.28,
      },
      subtitle1: {
        fontSize: '1rem',
        fontWeight: 500,
        lineHeight: 1.45,
      },
      body1: {
        fontSize: '1rem',
        lineHeight: 1.55,
      },
      body2: {
        fontSize: '0.875rem',
        lineHeight: 1.5,
      },
      button: {
        fontWeight: 600,
        textTransform: 'none',
        letterSpacing: '0.01em',
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          html: {
            overflowX: 'clip',
          },
          body: {
            overflowX: 'clip',
            margin: 0,
            WebkitFontSmoothing: 'antialiased',
          },
          'a:focus-visible, button:focus-visible, input:focus-visible, [tabindex]:focus-visible': {
            outline: '3px solid currentColor',
            outlineOffset: '2px',
          },
        },
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
        styleOverrides: {
          root: {
            borderRadius: 9999,
            minHeight: 48,
            paddingInline: 24,
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            minWidth: 48,
            minHeight: 48,
          },
        },
      },
      MuiCard: {
        defaultProps: {
          variant: 'outlined',
        },
        styleOverrides: {
          root: {
            borderRadius: 24,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            fontWeight: 500,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 28,
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 16,
          },
        },
      },
      MuiBottomNavigation: {
        styleOverrides: {
          root: {
            height: 72,
          },
        },
      },
      MuiBottomNavigationAction: {
        styleOverrides: {
          root: {
            minWidth: 64,
            minHeight: 48,
            paddingTop: 8,
            paddingBottom: 8,
          },
          label: {
            fontWeight: 500,
            '&.Mui-selected': {
              fontWeight: 700,
            },
          },
        },
      },
    },
  });
}

export const appTheme: Theme = erzeugeAppTheme(STANDARD_FARBSCHEMA);
