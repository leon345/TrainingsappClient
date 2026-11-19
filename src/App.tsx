import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined';
import FitnessCenterOutlinedIcon from '@mui/icons-material/FitnessCenterOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import AppBar from '@mui/material/AppBar';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import CssBaseline from '@mui/material/CssBaseline';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import { ThemeProvider, useTheme } from '@mui/material/styles';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import type { ReactElement } from 'react';
import { Link as RouterLink, Navigate, Route, Routes, useLocation } from 'react-router';
import { DatenschutzSeite } from './pages/DatenschutzSeite';
import { EntdeckenSeite } from './pages/EntdeckenSeite';
import { KontoSeite } from './pages/KontoSeite';
import { TimerSeite } from './pages/TimerSeite';
import { WorkoutsSeite } from './pages/WorkoutsSeite';
import { appTheme } from './theme/theme';

interface NavigationsPunkt {
  pfad: '/' | '/workouts' | '/entdecken' | '/konto';
  label: string;
  icon: ReactElement;
}

const NAVIGATIONSPUNKTE: readonly NavigationsPunkt[] = [
  { pfad: '/', label: 'Timer', icon: <TimerOutlinedIcon /> },
  { pfad: '/workouts', label: 'Workouts', icon: <FitnessCenterOutlinedIcon /> },
  { pfad: '/entdecken', label: 'Entdecken', icon: <ExploreOutlinedIcon /> },
  { pfad: '/konto', label: 'Konto', icon: <PersonOutlineOutlinedIcon /> },
];

function AppShell() {
  const theme = useTheme();
  const istDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const { pathname } = useLocation();

  const istTimerRoute = pathname === '/';
  const aktiverNavPfad = NAVIGATIONSPUNKTE.some((p) => p.pfad === pathname) ? pathname : false;

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100dvh',
        bgcolor: 'background.default',
        color: 'text.primary',
      }}
    >
      {istDesktop ? (
        <Box
          component="nav"
          aria-label="Hauptnavigation"
          sx={{
            width: 248,
            flexShrink: 0,
            borderRight: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            position: 'sticky',
            top: 0,
            height: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            p: 2,
          }}
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', px: 1.5, py: 1.5, mb: 1 }}>
            <TimerOutlinedIcon color="primary" />
            <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>
              Trainingsapp
            </Typography>
            <Chip label="PoC" size="small" color="primary" variant="outlined" />
          </Stack>

          <List sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {NAVIGATIONSPUNKTE.map((punkt) => {
              const aktiv = pathname === punkt.pfad;
              return (
                <ListItem key={punkt.pfad} disablePadding>
                  <ListItemButton
                    component={RouterLink}
                    to={punkt.pfad}
                    selected={aktiv}
                    aria-current={aktiv ? 'page' : undefined}
                    sx={{
                      borderRadius: 9999,
                      minHeight: 48,
                      px: 2,
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40, color: aktiv ? 'primary.main' : 'inherit' }}>
                      {punkt.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={punkt.label}
                      slotProps={{
                        primary: {
                          fontWeight: aktiv ? 700 : 500,
                        },
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </Box>
      ) : null}

      <Box
        sx={{
          flexGrow: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          pb: istDesktop ? 0 : '80px',
        }}
      >
        {!istDesktop ? (
          <AppBar
            position="sticky"
            color="inherit"
            elevation={0}
            sx={{
              bgcolor: 'background.paper',
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Toolbar sx={{ gap: 1.25 }}>
              <TimerOutlinedIcon color="primary" />
              <Typography variant="h6" component="span" sx={{ fontWeight: 700, flexGrow: 1 }}>
                Trainingsapp
              </Typography>
              <Chip label="PoC" size="small" color="primary" variant="outlined" />
            </Toolbar>
          </AppBar>
        ) : null}

        <Container
          component="main"
          maxWidth="md"
          sx={{
            flexGrow: 1,
            py: { xs: 3, md: 5 },
            px: { xs: 2, sm: 3 },
          }}
        >
          {/* Der Timer-Bereich bleibt beim Routenwechsel gemountet, damit ein aktiver Timer weiterlaeuft. */}
          <Box
            data-testid="timer-bereich"
            hidden={!istTimerRoute}
            sx={{ display: istTimerRoute ? 'block' : 'none' }}
          >
            <TimerSeite />
          </Box>

          <Routes>
            <Route path="/" element={null} />
            <Route path="/workouts" element={<WorkoutsSeite />} />
            <Route path="/entdecken" element={<EntdeckenSeite />} />
            <Route path="/konto" element={<KontoSeite />} />
            <Route path="/datenschutz" element={<DatenschutzSeite />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Container>

        <Container
          component="footer"
          maxWidth="md"
          sx={{
            px: { xs: 2, sm: 3 },
            pb: 3,
          }}
        >
          <Divider sx={{ mb: 2 }} />
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', sm: 'center' },
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Proof of Concept – vollständig KI-generiert („vibe-coded“). Keine Gewähr für
              Sicherheit oder Verfügbarkeit.
            </Typography>
            <Link
              component={RouterLink}
              to="/datenschutz"
              variant="body2"
              underline="hover"
              sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              Datenschutz &amp; PoC-Hinweis
            </Link>
          </Stack>
        </Container>
      </Box>

      {!istDesktop ? (
        <Paper
          component="nav"
          aria-label="Hauptnavigation"
          elevation={0}
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            borderTop: 1,
            borderColor: 'divider',
            zIndex: (t) => t.zIndex.appBar,
          }}
        >
          <BottomNavigation showLabels value={aktiverNavPfad}>
            {NAVIGATIONSPUNKTE.map((punkt) => (
              <BottomNavigationAction
                key={punkt.pfad}
                component={RouterLink}
                to={punkt.pfad}
                value={punkt.pfad}
                label={punkt.label}
                icon={punkt.icon}
                aria-current={pathname === punkt.pfad ? 'page' : undefined}
              />
            ))}
          </BottomNavigation>
        </Paper>
      ) : null}
    </Box>
  );
}

export function App() {
  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <AppShell />
    </ThemeProvider>
  );
}

export default App;
