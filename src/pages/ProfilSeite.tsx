import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import FitnessCenterOutlinedIcon from '@mui/icons-material/FitnessCenterOutlined';
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import SelfImprovementOutlinedIcon from '@mui/icons-material/SelfImprovementOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useLocation, useParams } from 'react-router';
import { extrahiereFehlermeldung, type WorkoutV1 } from '../api/client';
import { dauerAlsWorte, formatiereDauer } from '../format/dauer';
import { useAuth } from '../konto/AuthContext';
import { AnmeldeHinweisKarte } from '../workouts/AnmeldeHinweisKarte';
import { formatiereStartZeit, formatiereWorkoutTyp } from '../workouts/formularLogik';

interface ProfilNavigationsState {
  benutzername?: string;
}

export function ProfilSeite() {
  const { benutzerId } = useParams<{ benutzerId: string }>();
  const location = useLocation();
  const { status, fehlerMeldung: authFehler, apiClient, aktualisiereSitzung } = useAuth();

  const benutzername = (location.state as ProfilNavigationsState | null)?.benutzername ?? null;

  const [workouts, setWorkouts] = useState<WorkoutV1[]>([]);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [fehlerTyp, setFehlerTyp] = useState<'nichtGefunden' | 'verboten' | 'sonstig' | null>(null);

  const ladeProfilWorkouts = useCallback(async () => {
    if (!benutzerId) {
      setFehlerTyp('nichtGefunden');
      setFehler('Ungültige Benutzer-ID.');
      return;
    }

    setLaedt(true);
    setFehler(null);
    setFehlerTyp(null);

    try {
      const { data, error, response } = await apiClient.GET('/v1/profile/{benutzerId}/workouts', {
        params: { path: { benutzerId } },
      });

      if (response.status === 401) {
        await aktualisiereSitzung();
        return;
      }

      if (response.status === 404) {
        setWorkouts([]);
        setFehlerTyp('nichtGefunden');
        setFehler(
          extrahiereFehlermeldung(error, 'Das gesuchte Benutzerprofil wurde nicht gefunden.', response),
        );
        return;
      }

      if (response.status === 403) {
        setWorkouts([]);
        setFehlerTyp('verboten');
        setFehler(
          extrahiereFehlermeldung(
            error,
            'Du hast keine Berechtigung, öffentliche Workouts dieses Profils anzusehen.',
            response,
          ),
        );
        return;
      }

      if (response.ok && Array.isArray(data)) {
        setWorkouts(data);
        return;
      }

      setFehlerTyp('sonstig');
      setFehler(
        extrahiereFehlermeldung(error, 'Öffentliche Workouts konnten nicht geladen werden.', response),
      );
    } catch (ex) {
      setFehlerTyp('sonstig');
      setFehler(
        extrahiereFehlermeldung(
          ex,
          'Öffentliche Workouts konnten wegen eines Netzwerkfehlers nicht geladen werden.',
        ),
      );
    } finally {
      setLaedt(false);
    }
  }, [benutzerId, apiClient, aktualisiereSitzung]);

  useEffect(() => {
    if (status !== 'angemeldet') {
      return;
    }
    let aktiv = true;
    const lade = async () => {
      if (!aktiv) {
        return;
      }
      await ladeProfilWorkouts();
    };
    void lade();
    return () => {
      aktiv = false;
    };
  }, [status, ladeProfilWorkouts]);

  return (
    <Stack spacing={3}>
      <Box>
        <Button
          component={RouterLink}
          to="/entdecken"
          variant="text"
          startIcon={<ArrowBackOutlinedIcon />}
          sx={{ mb: 1, minHeight: 44, px: 1 }}
        >
          Zurück zu Entdecken
        </Button>

        <Typography variant="h1" gutterBottom sx={{ wordBreak: 'break-word' }}>
          {benutzername ? `Profil: ${benutzername}` : 'Öffentliches Profil'}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Öffentlich freigegebene Workouts dieses Benutzers (nur für angemeldete Benutzer sichtbar).
        </Typography>
      </Box>

      {status === 'ladend' ? (
        <Card>
          <CardContent sx={{ p: 4 }}>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'center' }}>
              <CircularProgress size={24} />
              <Typography variant="body1">Sitzung wird geprüft …</Typography>
            </Stack>
          </CardContent>
        </Card>
      ) : status !== 'angemeldet' ? (
        <AnmeldeHinweisKarte
          beschreibung="Melde dich mit deinem Passkey an, um öffentliche Profile anderer Benutzer anzusehen."
          fehlerMeldung={status === 'fehler' ? authFehler : null}
        />
      ) : laedt ? (
        <Card>
          <CardContent sx={{ p: 4 }}>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'center' }}>
              <CircularProgress size={24} />
              <Typography variant="body1">Öffentliche Workouts werden geladen …</Typography>
            </Stack>
          </CardContent>
        </Card>
      ) : fehlerTyp === 'nichtGefunden' ? (
        <Card>
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
              <Typography variant="h2">Profil nicht gefunden</Typography>
              <Alert severity="error" sx={{ width: '100%' }}>
                {fehler}
              </Alert>
              <Button component={RouterLink} to="/entdecken" variant="contained" sx={{ minHeight: 48 }}>
                Zurück zu Entdecken
              </Button>
            </Stack>
          </CardContent>
        </Card>
      ) : fehlerTyp === 'verboten' ? (
        <Alert severity="warning">{fehler}</Alert>
      ) : fehler ? (
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => void ladeProfilWorkouts()}
              sx={{ minHeight: 40 }}
            >
              Erneut versuchen
            </Button>
          }
        >
          {fehler}
        </Alert>
      ) : workouts.length === 0 ? (
        <Card>
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <Typography variant="body1" color="text.secondary">
              Dieser Benutzer hat aktuell keine öffentlichen Workouts freigegeben.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2}>
          {workouts.map((workout) => (
            <Card key={workout.id}>
              <CardActionArea
                component={RouterLink}
                to={`/workouts/${workout.id}`}
                state={{
                  zurueckPfad: benutzerId ? `/profil/${benutzerId}` : '/entdecken',
                  zurueckLabel: 'Zurück zum Profil',
                }}
              >
                <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
                  <Stack spacing={1.5}>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}
                    >
                      <Chip
                        size="small"
                        color={workout.typ === 'CALISTHENICS' ? 'secondary' : 'primary'}
                        icon={
                          workout.typ === 'CALISTHENICS' ? (
                            <SelfImprovementOutlinedIcon />
                          ) : (
                            <FitnessCenterOutlinedIcon />
                          )
                        }
                        label={formatiereWorkoutTyp(workout.typ)}
                      />
                      <Chip
                        size="small"
                        variant="outlined"
                        icon={<PublicOutlinedIcon />}
                        label="Öffentlich"
                      />
                    </Stack>

                    <Typography variant="h3" sx={{ wordBreak: 'break-word' }}>
                      {workout.titel}
                    </Typography>

                    <Stack
                      direction="row"
                      spacing={2}
                      sx={{
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        rowGap: 0.75,
                        color: 'text.secondary',
                      }}
                    >
                      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                        <CalendarTodayOutlinedIcon fontSize="small" />
                        <Typography variant="body2">
                          {formatiereStartZeit(workout.startZeit)}
                        </Typography>
                      </Stack>

                      {workout.dauerSekunden != null ? (
                        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                          <ScheduleOutlinedIcon fontSize="small" />
                          <Typography
                            variant="body2"
                            aria-label={dauerAlsWorte(workout.dauerSekunden)}
                          >
                            {formatiereDauer(workout.dauerSekunden)}
                          </Typography>
                        </Stack>
                      ) : null}

                      <Typography variant="body2">
                        {workout.uebungen.length === 1
                          ? '1 Übung'
                          : `${workout.uebungen.length} Übungen`}
                      </Typography>
                    </Stack>
                  </Stack>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
