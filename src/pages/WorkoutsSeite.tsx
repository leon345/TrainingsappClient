import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import FitnessCenterOutlinedIcon from '@mui/icons-material/FitnessCenterOutlined';
import FormatListNumberedOutlinedIcon from '@mui/icons-material/FormatListNumberedOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
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
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router';
import {
  extrahiereFehlermeldung,
  istWorkoutV1,
  type WorkoutTyp,
  type WorkoutV1,
} from '../api/client';
import { formatiereDatum } from '../format/datum';
import { dauerAlsWorte, formatiereDauer } from '../format/dauer';
import { useAuth } from '../konto/AuthContext';
import { AnmeldeHinweisKarte } from '../workouts/AnmeldeHinweisKarte';
import { formatiereSichtbarkeit, formatiereWorkoutTyp } from '../workouts/formularLogik';

type WorkoutFilter = 'ALLE' | WorkoutTyp;

function formatiereUebungsAnzahl(anzahl: number): string {
  return anzahl === 1 ? '1 Übung' : `${anzahl} Übungen`;
}

export function WorkoutsSeite() {
  const { status, fehlerMeldung: authFehler, apiClient, aktualisiereSitzung } = useAuth();
  const [filter, setFilter] = useState<WorkoutFilter>('ALLE');
  const [workouts, setWorkouts] = useState<WorkoutV1[]>([]);
  const [laedt, setLaedt] = useState<boolean>(false);
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);

  const ladeWorkouts = useCallback(
    async (aktuellerFilter: WorkoutFilter) => {
      setLaedt(true);
      setLadeFehler(null);

      try {
        const { data, error, response } = await apiClient.GET('/v1/workouts', {
          params: {
            query: aktuellerFilter === 'ALLE' ? undefined : { typ: aktuellerFilter },
          },
        });

        if (response.status === 401) {
          await aktualisiereSitzung();
          return;
        }

        if (response.ok && Array.isArray(data)) {
          setWorkouts(data.filter(istWorkoutV1));
          return;
        }

        setLadeFehler(
          extrahiereFehlermeldung(error, 'Workouts konnten nicht geladen werden.', response),
        );
      } catch (ex) {
        setLadeFehler(
          extrahiereFehlermeldung(ex, 'Workouts konnten wegen eines Netzwerkfehlers nicht geladen werden.'),
        );
      } finally {
        setLaedt(false);
      }
    },
    [apiClient, aktualisiereSitzung],
  );

  useEffect(() => {
    if (status !== 'angemeldet') {
      return;
    }
    let aktiv = true;
    const lade = async () => {
      if (!aktiv) {
        return;
      }
      await ladeWorkouts(filter);
    };
    void lade();
    return () => {
      aktiv = false;
    };
  }, [status, filter, ladeWorkouts]);

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'flex-start' } }}
      >
        <Box>
          <Typography variant="h1" gutterBottom>
            Workouts
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Kraft- und Calisthenics-Workouts mit Übungen, Sätzen und Fortschritt erfassen.
          </Typography>
        </Box>

        {status === 'angemeldet' ? (
          <Button
            component={RouterLink}
            to="/workouts/neu"
            variant="contained"
            size="large"
            startIcon={<AddOutlinedIcon />}
            sx={{ minHeight: 48, whiteSpace: 'nowrap', alignSelf: { xs: 'stretch', sm: 'center' } }}
          >
            Neues Workout
          </Button>
        ) : null}
      </Stack>

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
          beschreibung="Melde dich mit deinem Passkey an, um eigene Kraft- und Calisthenics-Workouts zu erfassen, zu filtern und zu bearbeiten."
          fehlerMeldung={status === 'fehler' ? authFehler : null}
        />
      ) : (
        <Stack spacing={2.5}>
          <ToggleButtonGroup
            exclusive
            value={filter}
            onChange={(_, neuerFilter: WorkoutFilter | null) => {
              if (neuerFilter) {
                setFilter(neuerFilter);
              }
            }}
            aria-label="Workouts nach Typ filtern"
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              width: { xs: '100%', sm: 'auto' },
              alignSelf: { xs: 'stretch', sm: 'flex-start' },
            }}
          >
            <ToggleButton value="ALLE" sx={{ minHeight: 48, px: { xs: 1.5, sm: 2.5 } }}>
              Alle
            </ToggleButton>
            <ToggleButton value="KRAFT" sx={{ minHeight: 48, px: { xs: 1.5, sm: 2.5 } }}>
              Kraft
            </ToggleButton>
            <ToggleButton value="CALISTHENICS" sx={{ minHeight: 48, px: { xs: 1.5, sm: 2.5 } }}>
              Calisthenics
            </ToggleButton>
          </ToggleButtonGroup>

          {ladeFehler ? (
            <Alert
              severity="error"
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => void ladeWorkouts(filter)}
                  sx={{ minHeight: 40 }}
                >
                  Erneut versuchen
                </Button>
              }
            >
              {ladeFehler}
            </Alert>
          ) : null}

          {laedt ? (
            <Card>
              <CardContent sx={{ p: 4 }}>
                <Stack
                  direction="row"
                  spacing={2}
                  sx={{ alignItems: 'center', justifyContent: 'center' }}
                >
                  <CircularProgress size={24} />
                  <Typography variant="body1">Workouts werden geladen …</Typography>
                </Stack>
              </CardContent>
            </Card>
          ) : workouts.length === 0 && !ladeFehler ? (
            <Card>
              <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
                <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
                  <Typography variant="h3">
                    {filter === 'ALLE'
                      ? 'Noch keine Workouts gespeichert'
                      : `Keine ${formatiereWorkoutTyp(filter)}-Workouts vorhanden`}
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    {filter === 'ALLE'
                      ? 'Lege dein erstes Kraft- oder Calisthenics-Workout mit Übungen und Sätzen an.'
                      : 'Wechsle den Filter oder erfasse ein neues Workout dieses Typs.'}
                  </Typography>
                  <Button
                    component={RouterLink}
                    to="/workouts/neu"
                    variant="contained"
                    startIcon={<AddOutlinedIcon />}
                    sx={{ minHeight: 48 }}
                  >
                    Neues Workout anlegen
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          ) : (
            <Stack spacing={2} component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
              {workouts.map((workout) => (
                <Box component="li" key={workout.id}>
                  <Card>
                    <CardActionArea
                      component={RouterLink}
                      to={`/workouts/${workout.id}`}
                      sx={{ display: 'block', textAlign: 'left' }}
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
                              icon={
                                workout.sichtbarkeit === 'OEFFENTLICH' ? (
                                  <PublicOutlinedIcon />
                                ) : (
                                  <LockOutlinedIcon />
                                )
                              }
                              label={formatiereSichtbarkeit(workout.sichtbarkeit)}
                            />
                          </Stack>

                          <Typography
                            variant="h3"
                            sx={{ wordBreak: 'break-word' }}
                          >
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
                              <CalendarTodayOutlinedIcon sx={{ fontSize: 16 }} />
                              <Typography variant="body2">
                                {formatiereDatum(workout.startZeit)}
                              </Typography>
                            </Stack>

                            {workout.dauerSekunden != null ? (
                              <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                                <ScheduleOutlinedIcon sx={{ fontSize: 16 }} />
                                <Typography
                                  variant="body2"
                                  aria-label={dauerAlsWorte(workout.dauerSekunden)}
                                >
                                  {formatiereDauer(workout.dauerSekunden)}
                                </Typography>
                              </Stack>
                            ) : null}

                            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                              <FormatListNumberedOutlinedIcon sx={{ fontSize: 16 }} />
                              <Typography variant="body2">
                                {formatiereUebungsAnzahl(workout.uebungen.length)}
                              </Typography>
                            </Stack>
                          </Stack>

                          {workout.notiz ? (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}
                            >
                              {workout.notiz}
                            </Typography>
                          ) : null}
                        </Stack>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Box>
              ))}
            </Stack>
          )}
        </Stack>
      )}
    </Stack>
  );
}
