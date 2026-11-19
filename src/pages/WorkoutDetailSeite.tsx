import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import FitnessCenterOutlinedIcon from '@mui/icons-material/FitnessCenterOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import SelfImprovementOutlinedIcon from '@mui/icons-material/SelfImprovementOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate, useParams } from 'react-router';
import {
  extrahiereFehlermeldung,
  istFehlerV1,
  istWorkoutV1,
  type WorkoutErstellenV1,
  type WorkoutV1,
} from '../api/client';
import { dauerAlsWorte, formatiereDauer } from '../format/dauer';
import { useAuth } from '../konto/AuthContext';
import { AnmeldeHinweisKarte } from '../workouts/AnmeldeHinweisKarte';
import {
  formatiereGewichtKg,
  formatiereSichtbarkeit,
  formatiereStartZeit,
  formatiereWorkoutTyp,
  workoutZuFormularZustand,
  zuWorkoutAktualisierenBody,
} from '../workouts/formularLogik';
import { WorkoutFormular } from '../workouts/WorkoutFormular';

interface DetailNavigationsState {
  hinweis?: string;
}

export function WorkoutDetailSeite() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { status, fehlerMeldung: authFehler, apiClient, aktualisiereSitzung } = useAuth();

  const initialHinweis = (location.state as DetailNavigationsState | null)?.hinweis ?? null;

  const [workout, setWorkout] = useState<WorkoutV1 | null>(null);
  const [laedt, setLaedt] = useState<boolean>(false);
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);
  const [nichtGefunden, setNichtGefunden] = useState<boolean>(false);

  const [bearbeiten, setBearbeiten] = useState<boolean>(false);
  const [formularGeneration, setFormularGeneration] = useState<number>(0);
  const [speichert, setSpeichert] = useState<boolean>(false);
  const [speicherFehler, setSpeicherFehler] = useState<string | null>(null);
  const [istVersionsKonflikt, setIstVersionsKonflikt] = useState<boolean>(false);
  const [erfolgsHinweis, setErfolgsHinweis] = useState<string | null>(initialHinweis);

  const [loeschDialogOffen, setLoeschDialogOffen] = useState<boolean>(false);
  const [loescht, setLoescht] = useState<boolean>(false);
  const [loeschFehler, setLoeschFehler] = useState<string | null>(null);

  const dialogTitelId = useId();

  const ladeWorkout = useCallback(async () => {
    if (!id) {
      setNichtGefunden(true);
      setLadeFehler('Ungültige Workout-ID.');
      return;
    }

    setLaedt(true);
    setLadeFehler(null);
    setNichtGefunden(false);

    try {
      const { data, error, response } = await apiClient.GET('/v1/workouts/{id}', {
        params: { path: { id } },
      });

      if (response.status === 401) {
        await aktualisiereSitzung();
        return;
      }

      if (response.status === 404) {
        setWorkout(null);
        setNichtGefunden(true);
        setLadeFehler(
          extrahiereFehlermeldung(error, 'Das gesuchte Workout wurde nicht gefunden.', response),
        );
        return;
      }

      if (response.ok && istWorkoutV1(data)) {
        setWorkout(data);
        setFormularGeneration((n) => n + 1);
        setSpeicherFehler(null);
        setIstVersionsKonflikt(false);
        return;
      }

      setLadeFehler(
        extrahiereFehlermeldung(error, 'Das Workout konnte nicht geladen werden.', response),
      );
    } catch (ex) {
      setLadeFehler(
        extrahiereFehlermeldung(
          ex,
          'Das Workout konnte wegen eines Netzwerkfehlers nicht geladen werden.',
        ),
      );
    } finally {
      setLaedt(false);
    }
  }, [id, apiClient, aktualisiereSitzung]);

  useEffect(() => {
    if (status !== 'angemeldet') {
      return;
    }
    let aktiv = true;
    const lade = async () => {
      if (!aktiv) {
        return;
      }
      await ladeWorkout();
    };
    void lade();
    return () => {
      aktiv = false;
    };
  }, [status, ladeWorkout]);

  const sortierteUebungen = useMemo(() => {
    if (!workout) {
      return [];
    }
    return [...workout.uebungen]
      .sort((a, b) => a.position - b.position)
      .map((u) => ({
        ...u,
        saetze: [...u.saetze].sort((a, b) => a.position - b.position),
      }));
  }, [workout]);

  const beimSpeichern = async (body: WorkoutErstellenV1) => {
    if (!id || !workout) {
      return;
    }

    setSpeichert(true);
    setSpeicherFehler(null);
    setIstVersionsKonflikt(false);
    setErfolgsHinweis(null);

    try {
      const { data, error, response } = await apiClient.PUT('/v1/workouts/{id}', {
        params: { path: { id } },
        body: zuWorkoutAktualisierenBody(body, workout.version),
      });

      if (response.status === 401) {
        await aktualisiereSitzung();
        return;
      }

      if (response.ok && istWorkoutV1(data)) {
        setWorkout(data);
        setBearbeiten(false);
        setFormularGeneration((n) => n + 1);
        setErfolgsHinweis('Änderungen wurden gespeichert.');
        return;
      }

      if (
        response.status === 409 ||
        (istFehlerV1(error) && error.code === 'WORKOUT_VERSIONSKONFLIKT')
      ) {
        setIstVersionsKonflikt(true);
        setSpeicherFehler(
          extrahiereFehlermeldung(
            error,
            'Das Workout wurde zwischenzeitlich geändert. Bitte lade es neu.',
            response,
          ),
        );
        return;
      }

      if (response.status === 404) {
        setNichtGefunden(true);
        setBearbeiten(false);
        setLadeFehler(
          extrahiereFehlermeldung(error, 'Das Workout wurde nicht gefunden.', response),
        );
        return;
      }

      setSpeicherFehler(
        extrahiereFehlermeldung(error, 'Änderungen konnten nicht gespeichert werden.', response),
      );
    } catch (ex) {
      setSpeicherFehler(
        extrahiereFehlermeldung(
          ex,
          'Änderungen konnten wegen eines Netzwerkfehlers nicht gespeichert werden.',
        ),
      );
    } finally {
      setSpeichert(false);
    }
  };

  const beimLoeschen = async () => {
    if (!id) {
      return;
    }

    setLoescht(true);
    setLoeschFehler(null);

    try {
      const { error, response } = await apiClient.DELETE('/v1/workouts/{id}', {
        params: { path: { id } },
      });

      if (response.status === 401) {
        await aktualisiereSitzung();
        return;
      }

      if (response.status === 204 || response.ok) {
        setLoeschDialogOffen(false);
        void navigate('/workouts', { replace: true });
        return;
      }

      setLoeschFehler(
        extrahiereFehlermeldung(error, 'Workout konnte nicht gelöscht werden.', response),
      );
    } catch (ex) {
      setLoeschFehler(
        extrahiereFehlermeldung(
          ex,
          'Workout konnte wegen eines Netzwerkfehlers nicht gelöscht werden.',
        ),
      );
    } finally {
      setLoescht(false);
    }
  };

  return (
    <Stack spacing={3}>
      <Box>
        <Button
          component={RouterLink}
          to="/workouts"
          variant="text"
          startIcon={<ArrowBackOutlinedIcon />}
          sx={{ mb: 1, minHeight: 44, px: 1 }}
        >
          Zurück zu Workouts
        </Button>
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
          beschreibung="Melde dich mit deinem Passkey an, um deine Workout-Details anzuzeigen und zu bearbeiten."
          fehlerMeldung={status === 'fehler' ? authFehler : null}
        />
      ) : laedt && !workout ? (
        <Card>
          <CardContent sx={{ p: 4 }}>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'center' }}>
              <CircularProgress size={24} />
              <Typography variant="body1">Workout wird geladen …</Typography>
            </Stack>
          </CardContent>
        </Card>
      ) : nichtGefunden ? (
        <Card>
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
              <Typography variant="h1">Workout nicht gefunden</Typography>
              <Alert severity="error" sx={{ width: '100%' }}>
                {ladeFehler ?? 'Das gesuchte Workout existiert nicht oder gehört zu einem anderen Konto.'}
              </Alert>
              <Button
                component={RouterLink}
                to="/workouts"
                variant="contained"
                sx={{ minHeight: 48 }}
              >
                Zurück zu Workouts
              </Button>
            </Stack>
          </CardContent>
        </Card>
      ) : ladeFehler && !workout ? (
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => void ladeWorkout()}
              sx={{ minHeight: 40 }}
            >
              Erneut versuchen
            </Button>
          }
        >
          {ladeFehler}
        </Alert>
      ) : workout ? (
        bearbeiten ? (
          <Stack spacing={2.5}>
            <Typography variant="h1">Workout bearbeiten</Typography>
            <WorkoutFormular
              key={`${workout.id}-${workout.version}-${formularGeneration}`}
              initialZustand={workoutZuFormularZustand(workout)}
              absendenLabel="Änderungen speichern"
              speichert={speichert}
              serverFehler={speicherFehler}
              istVersionsKonflikt={istVersionsKonflikt}
              onNeuLaden={() => void ladeWorkout()}
              onAbbrechen={() => {
                setBearbeiten(false);
                setSpeicherFehler(null);
                setIstVersionsKonflikt(false);
              }}
              onAbsenden={beimSpeichern}
            />
          </Stack>
        ) : (
          <Stack spacing={3}>
            {erfolgsHinweis ? (
              <Alert severity="success" onClose={() => setErfolgsHinweis(null)}>
                {erfolgsHinweis}
              </Alert>
            ) : null}

            <Card>
              <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
                <Stack spacing={2}>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}
                  >
                    <Chip
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

                  <Typography variant="h1" sx={{ wordBreak: 'break-word' }}>
                    {workout.titel}
                  </Typography>

                  <Stack
                    direction="row"
                    spacing={2.5}
                    sx={{
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      rowGap: 1,
                      color: 'text.secondary',
                    }}
                  >
                    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                      <CalendarTodayOutlinedIcon fontSize="small" />
                      <Typography variant="body1">
                        {formatiereStartZeit(workout.startZeit)}
                      </Typography>
                    </Stack>

                    {workout.dauerSekunden !== undefined ? (
                      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                        <ScheduleOutlinedIcon fontSize="small" />
                        <Typography
                          variant="body1"
                          aria-label={dauerAlsWorte(workout.dauerSekunden)}
                        >
                          {formatiereDauer(workout.dauerSekunden)}
                        </Typography>
                      </Stack>
                    ) : null}
                  </Stack>

                  {workout.notiz ? (
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                      {workout.notiz}
                    </Typography>
                  ) : null}

                  <Divider />

                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1.5}
                  >
                    <Button
                      variant="contained"
                      startIcon={<EditOutlinedIcon />}
                      onClick={() => {
                        setErfolgsHinweis(null);
                        setSpeicherFehler(null);
                        setIstVersionsKonflikt(false);
                        setBearbeiten(true);
                      }}
                      sx={{ minHeight: 48 }}
                    >
                      Bearbeiten
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<DeleteOutlineOutlinedIcon />}
                      onClick={() => {
                        setLoeschFehler(null);
                        setLoeschDialogOffen(true);
                      }}
                      sx={{ minHeight: 48 }}
                    >
                      Löschen
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            <Stack spacing={2}>
              <Typography variant="h2">
                Übungen ({sortierteUebungen.length})
              </Typography>

              {sortierteUebungen.length === 0 ? (
                <Card>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="body1" color="text.secondary">
                      Für dieses Workout wurden noch keine Übungen hinterlegt.
                    </Typography>
                  </CardContent>
                </Card>
              ) : (
                sortierteUebungen.map((uebung, uIndex) => (
                  <Card key={uebung.id}>
                    <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
                      <Stack spacing={2}>
                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}
                        >
                          <Typography variant="h3" sx={{ wordBreak: 'break-word' }}>
                            {uIndex + 1}. {uebung.name}
                          </Typography>
                          {uebung.variante ? (
                            <Chip size="small" variant="outlined" label={uebung.variante} />
                          ) : null}
                        </Stack>

                        {uebung.saetze.length === 0 ? (
                          <Typography variant="body2" color="text.secondary">
                            Keine Sätze erfasst.
                          </Typography>
                        ) : (
                          <Stack spacing={1}>
                            {uebung.saetze.map((satz, sIndex) => (
                              <Paper
                                key={satz.id}
                                variant="outlined"
                                sx={{
                                  p: 1.5,
                                  borderRadius: 2,
                                  bgcolor: 'background.default',
                                }}
                              >
                                <Stack
                                  direction="row"
                                  spacing={1.5}
                                  sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.75 }}
                                >
                                  <Typography variant="subtitle2" sx={{ fontWeight: 700, minWidth: 56 }}>
                                    Satz {sIndex + 1}
                                  </Typography>

                                  {satz.wiederholungen !== undefined ? (
                                    <Chip
                                      size="small"
                                      label={`${satz.wiederholungen} Wdh.`}
                                    />
                                  ) : null}

                                  {satz.dauerSekunden !== undefined ? (
                                    <Chip
                                      size="small"
                                      label={formatiereDauer(satz.dauerSekunden)}
                                      aria-label={`Dauer: ${dauerAlsWorte(satz.dauerSekunden)}`}
                                    />
                                  ) : null}

                                  {satz.gewichtKg !== undefined ? (
                                    <Chip
                                      size="small"
                                      variant="outlined"
                                      label={formatiereGewichtKg(satz.gewichtKg)}
                                    />
                                  ) : null}

                                  {satz.pauseSekunden !== undefined ? (
                                    <Typography
                                      variant="body2"
                                      color="text.secondary"
                                      aria-label={`Pause: ${dauerAlsWorte(satz.pauseSekunden)}`}
                                    >
                                      Pause {formatiereDauer(satz.pauseSekunden)}
                                    </Typography>
                                  ) : null}
                                </Stack>
                              </Paper>
                            ))}
                          </Stack>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                ))
              )}
            </Stack>

            <Dialog
              open={loeschDialogOffen}
              onClose={() => {
                if (!loescht) {
                  setLoeschDialogOffen(false);
                }
              }}
              aria-labelledby={dialogTitelId}
            >
              <DialogTitle id={dialogTitelId}>Workout löschen?</DialogTitle>
              <DialogContent>
                <Stack spacing={2}>
                  <DialogContentText>
                    Möchtest du das Workout „{workout.titel}“ wirklich dauerhaft löschen? Alle
                    zugehörigen Übungen und Sätze werden entfernt.
                  </DialogContentText>
                  {loeschFehler ? <Alert severity="error">{loeschFehler}</Alert> : null}
                </Stack>
              </DialogContent>
              <DialogActions sx={{ px: 3, pb: 2.5 }}>
                <Button
                  onClick={() => setLoeschDialogOffen(false)}
                  disabled={loescht}
                  sx={{ minHeight: 44 }}
                >
                  Abbrechen
                </Button>
                <Button
                  color="error"
                  variant="contained"
                  disabled={loescht}
                  onClick={() => void beimLoeschen()}
                  sx={{ minHeight: 44 }}
                >
                  {loescht ? 'Löscht …' : 'Löschen'}
                </Button>
              </DialogActions>
            </Dialog>
          </Stack>
        )
      ) : null}
    </Stack>
  );
}
