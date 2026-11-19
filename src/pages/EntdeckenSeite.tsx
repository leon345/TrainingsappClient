import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import FitnessCenterOutlinedIcon from '@mui/icons-material/FitnessCenterOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import SelfImprovementOutlinedIcon from '@mui/icons-material/SelfImprovementOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link as RouterLink } from 'react-router';
import {
  extrahiereFehlermeldung,
  istBenutzerKurzV1,
  type BenutzerKurzV1,
  type GeteiltesWorkoutV1,
} from '../api/client';
import { dauerAlsWorte, formatiereDauer } from '../format/dauer';
import { formatiereDatum } from '../format/datum';
import { useAuth } from '../konto/AuthContext';
import { normalisiereBenutzername } from '../konto/benutzername';
import { AnmeldeHinweisKarte } from '../workouts/AnmeldeHinweisKarte';
import {
  formatiereSichtbarkeit,
  formatiereStartZeit,
  formatiereWorkoutTyp,
} from '../workouts/formularLogik';

export function EntdeckenSeite() {
  const { status, fehlerMeldung: authFehler, apiClient, aktualisiereSitzung } = useAuth();

  const [geteilteWorkouts, setGeteilteWorkouts] = useState<GeteiltesWorkoutV1[]>([]);
  const [laedtGeteilt, setLaedtGeteilt] = useState(false);
  const [geteiltFehler, setGeteiltFehler] = useState<string | null>(null);

  const [suchEingabe, setSuchEingabe] = useState('');
  const [suchtProfil, setSuchtProfil] = useState(false);
  const [suchFehler, setSuchFehler] = useState<string | null>(null);
  const [gefundenerBenutzer, setGefundenerBenutzer] = useState<BenutzerKurzV1 | null>(null);

  const ladeGeteilteWorkouts = useCallback(async () => {
    setLaedtGeteilt(true);
    setGeteiltFehler(null);

    try {
      const { data, error, response } = await apiClient.GET('/v1/workouts/geteilt');

      if (response.status === 401) {
        await aktualisiereSitzung();
        return;
      }

      if (response.ok && Array.isArray(data)) {
        setGeteilteWorkouts(data);
        return;
      }

      setGeteiltFehler(
        extrahiereFehlermeldung(
          error,
          'Mit dir geteilte Workouts konnten nicht geladen werden.',
          response,
        ),
      );
    } catch (ex) {
      setGeteiltFehler(
        extrahiereFehlermeldung(
          ex,
          'Mit dir geteilte Workouts konnten wegen eines Netzwerkfehlers nicht geladen werden.',
        ),
      );
    } finally {
      setLaedtGeteilt(false);
    }
  }, [apiClient, aktualisiereSitzung]);

  useEffect(() => {
    if (status !== 'angemeldet') {
      return;
    }
    let aktiv = true;
    const lade = async () => {
      if (!aktiv) {
        return;
      }
      await ladeGeteilteWorkouts();
    };
    void lade();
    return () => {
      aktiv = false;
    };
  }, [status, ladeGeteilteWorkouts]);

  const handleProfilSuche = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalisiert = normalisiereBenutzername(suchEingabe);
    if (normalisiert.length === 0) {
      setSuchFehler('Bitte gib einen exakten Benutzernamen ein.');
      setGefundenerBenutzer(null);
      return;
    }

    setSuchtProfil(true);
    setSuchFehler(null);
    setGefundenerBenutzer(null);

    try {
      const { data, error, response } = await apiClient.GET('/v1/benutzer/suche', {
        params: { query: { name: normalisiert } },
      });

      if (response.status === 401) {
        await aktualisiereSitzung();
        return;
      }

      if (response.ok && istBenutzerKurzV1(data)) {
        setGefundenerBenutzer(data);
        return;
      }

      if (response.status === 404) {
        setSuchFehler(
          extrahiereFehlermeldung(
            error,
            `Kein Benutzer mit dem exakten Namen „${normalisiert}“ gefunden.`,
            response,
          ),
        );
        return;
      }

      setSuchFehler(extrahiereFehlermeldung(error, 'Profilsuche fehlgeschlagen.', response));
    } catch (ex) {
      setSuchFehler(
        extrahiereFehlermeldung(ex, 'Profilsuche wegen eines Netzwerkfehlers fehlgeschlagen.'),
      );
    } finally {
      setSuchtProfil(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h1" gutterBottom>
          Entdecken
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Mit dir geteilte Workouts ansehen und öffentliche Profile anderer Benutzer per exaktem
          Benutzernamen finden.
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
          beschreibung="Melde dich mit deinem Passkey an, um mit dir geteilte Workouts und öffentliche Profile anderer Benutzer anzusehen."
          fehlerMeldung={status === 'fehler' ? authFehler : null}
        />
      ) : (
        <Stack spacing={3}>
          <Card>
            <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="h3" component="h2" gutterBottom>
                    Öffentliches Profil suchen
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Suche gezielt nach dem exakten Benutzernamen, um öffentlich freigegebene
                    Workouts dieses Profils anzusehen.
                  </Typography>
                </Box>

                <Box component="form" noValidate onSubmit={(e) => void handleProfilSuche(e)}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1.5}
                    sx={{ alignItems: { sm: 'flex-start' } }}
                  >
                    <TextField
                      id="entdecken-profil-suche"
                      label="Benutzername (exakt)"
                      fullWidth
                      value={suchEingabe}
                      onChange={(e) => {
                        setSuchEingabe(e.target.value);
                        setGefundenerBenutzer(null);
                        if (suchFehler) {
                          setSuchFehler(null);
                        }
                      }}
                      disabled={suchtProfil}
                    />
                    <Button
                      type="submit"
                      variant="contained"
                      startIcon={<SearchOutlinedIcon />}
                      disabled={suchtProfil}
                      sx={{ whiteSpace: 'nowrap', minHeight: 56, flexShrink: 0, px: 3 }}
                    >
                      {suchtProfil ? 'Sucht …' : 'Profil suchen'}
                    </Button>
                  </Stack>
                </Box>

                {suchFehler ? <Alert severity="error">{suchFehler}</Alert> : null}

                {gefundenerBenutzer ? (
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      borderColor: 'primary.main',
                      bgcolor: 'background.default',
                    }}
                  >
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1.5}
                      sx={{
                        alignItems: { xs: 'flex-start', sm: 'center' },
                        justifyContent: 'space-between',
                      }}
                    >
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
                        <PersonOutlineOutlinedIcon color="primary" />
                        <Typography
                          variant="subtitle1"
                          sx={{ fontWeight: 700, wordBreak: 'break-word' }}
                        >
                          {gefundenerBenutzer.benutzername}
                        </Typography>
                      </Stack>
                      <Button
                        component={RouterLink}
                        to={`/profil/${gefundenerBenutzer.id}`}
                        state={{ benutzername: gefundenerBenutzer.benutzername }}
                        variant="outlined"
                        sx={{ minHeight: 44 }}
                      >
                        Öffentliches Profil ansehen
                      </Button>
                    </Stack>
                  </Paper>
                ) : null}
              </Stack>
            </CardContent>
          </Card>

          <Stack spacing={2}>
            <Typography variant="h2">Mit mir geteilte Workouts</Typography>

            {geteiltFehler ? (
              <Alert
                severity="error"
                action={
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => void ladeGeteilteWorkouts()}
                    sx={{ minHeight: 40 }}
                  >
                    Erneut versuchen
                  </Button>
                }
              >
                {geteiltFehler}
              </Alert>
            ) : laedtGeteilt ? (
              <Card>
                <CardContent sx={{ p: 4 }}>
                  <Stack
                    direction="row"
                    spacing={2}
                    sx={{ alignItems: 'center', justifyContent: 'center' }}
                  >
                    <CircularProgress size={24} />
                    <Typography variant="body1">Geteilte Workouts werden geladen …</Typography>
                  </Stack>
                </CardContent>
              </Card>
            ) : geteilteWorkouts.length === 0 ? (
              <Card>
                <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
                  <Typography variant="body1" color="text.secondary">
                    Es wurden noch keine Workouts mit dir geteilt.
                  </Typography>
                </CardContent>
              </Card>
            ) : (
              <Stack spacing={2}>
                {geteilteWorkouts.map((workout) => (
                  <Card key={workout.id}>
                    <CardActionArea
                      component={RouterLink}
                      to={`/workouts/${workout.id}`}
                      state={{
                        zurueckPfad: '/entdecken',
                        zurueckLabel: 'Zurück zu Entdecken',
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
                              icon={
                                workout.sichtbarkeit === 'OEFFENTLICH' ? (
                                  <PublicOutlinedIcon />
                                ) : (
                                  <LockOutlinedIcon />
                                )
                              }
                              label={formatiereSichtbarkeit(workout.sichtbarkeit)}
                            />
                            <Chip
                              size="small"
                              variant="outlined"
                              icon={<PersonOutlineOutlinedIcon />}
                              label={`Von ${workout.ownerBenutzername}`}
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

                            {workout.dauerSekunden !== undefined ? (
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

                            <Typography variant="body2">
                              Eingeladen am {formatiereDatum(workout.eingeladenAm)}
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
        </Stack>
      )}
    </Stack>
  );
}
