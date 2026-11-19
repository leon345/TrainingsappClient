import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PersonAddAlt1OutlinedIcon from '@mui/icons-material/PersonAddAlt1Outlined';
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useId, useState, type FormEvent } from 'react';
import {
  extrahiereFehlermeldung,
  istBenutzerKurzV1,
  istWorkoutV1,
  type ApiClient,
  type BenutzerKurzV1,
  type Sichtbarkeit,
  type WorkoutEinladungV1,
  type WorkoutV1,
} from '../api/client';
import { formatiereDatum } from '../format/datum';
import { normalisiereBenutzername } from '../konto/benutzername';

export interface WorkoutTeilenBereichProps {
  readonly workout: WorkoutV1;
  readonly einladungen: readonly WorkoutEinladungV1[];
  readonly apiClient: ApiClient;
  readonly onSitzungAbgelaufen: () => Promise<unknown>;
  readonly onWorkoutAktualisiert: (workout: WorkoutV1, hinweis: string) => void;
  readonly onEinladungenAktualisiert: (einladungen: WorkoutEinladungV1[]) => void;
}

export function WorkoutTeilenBereich({
  workout,
  einladungen,
  apiClient,
  onSitzungAbgelaufen,
  onWorkoutAktualisiert,
  onEinladungenAktualisiert,
}: WorkoutTeilenBereichProps) {
  const [sichtbarkeitSpeichert, setSichtbarkeitSpeichert] = useState(false);
  const [sichtbarkeitFehler, setSichtbarkeitFehler] = useState<string | null>(null);

  const [einladungFehler, setEinladungFehler] = useState<string | null>(null);
  const [einladungErfolg, setEinladungErfolg] = useState<string | null>(null);
  const [entferntId, setEntferntId] = useState<string | null>(null);

  const [dialogOffen, setDialogOffen] = useState(false);
  const [suchEingabe, setSuchEingabe] = useState('');
  const [sucht, setSucht] = useState(false);
  const [suchFehler, setSuchFehler] = useState<string | null>(null);
  const [gefundenerBenutzer, setGefundenerBenutzer] = useState<BenutzerKurzV1 | null>(null);
  const [laedtEin, setLaedtEin] = useState(false);

  const dialogTitelId = useId();

  const schliesseDialog = () => {
    if (laedtEin) {
      return;
    }
    setDialogOffen(false);
    setSuchEingabe('');
    setSuchFehler(null);
    setGefundenerBenutzer(null);
  };

  const handleSichtbarkeitAendern = async (
    _event: unknown,
    neueSichtbarkeit: Sichtbarkeit | null,
  ) => {
    if (!neueSichtbarkeit || neueSichtbarkeit === workout.sichtbarkeit || sichtbarkeitSpeichert) {
      return;
    }

    setSichtbarkeitSpeichert(true);
    setSichtbarkeitFehler(null);

    try {
      const { data, error, response } = await apiClient.PATCH('/v1/workouts/{id}/sichtbarkeit', {
        params: { path: { id: workout.id } },
        body: { sichtbarkeit: neueSichtbarkeit },
      });

      if (response.status === 401) {
        await onSitzungAbgelaufen();
        return;
      }

      if (response.ok && istWorkoutV1(data)) {
        onWorkoutAktualisiert(
          data,
          data.sichtbarkeit === 'OEFFENTLICH'
            ? 'Sichtbarkeit wurde auf „Öffentlich“ geändert.'
            : 'Sichtbarkeit wurde auf „Privat“ geändert.',
        );
        return;
      }

      setSichtbarkeitFehler(
        extrahiereFehlermeldung(
          error,
          'Sichtbarkeit konnte nicht aktualisiert werden.',
          response,
        ),
      );
    } catch (ex) {
      setSichtbarkeitFehler(
        extrahiereFehlermeldung(
          ex,
          'Sichtbarkeit konnte wegen eines Netzwerkfehlers nicht aktualisiert werden.',
        ),
      );
    } finally {
      setSichtbarkeitSpeichert(false);
    }
  };

  const handleBenutzerSuchen = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalisiert = normalisiereBenutzername(suchEingabe);
    if (normalisiert.length === 0) {
      setSuchFehler('Bitte gib einen exakten Benutzernamen ein.');
      setGefundenerBenutzer(null);
      return;
    }

    setSucht(true);
    setSuchFehler(null);
    setGefundenerBenutzer(null);

    try {
      const { data, error, response } = await apiClient.GET('/v1/benutzer/suche', {
        params: { query: { name: normalisiert } },
      });

      if (response.status === 401) {
        setDialogOffen(false);
        await onSitzungAbgelaufen();
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

      setSuchFehler(
        extrahiereFehlermeldung(error, 'Benutzersuche fehlgeschlagen.', response),
      );
    } catch (ex) {
      setSuchFehler(
        extrahiereFehlermeldung(
          ex,
          'Benutzersuche wegen eines Netzwerkfehlers fehlgeschlagen.',
        ),
      );
    } finally {
      setSucht(false);
    }
  };

  const handleEinladen = async () => {
    if (!gefundenerBenutzer || laedtEin) {
      return;
    }

    setLaedtEin(true);
    setSuchFehler(null);
    setEinladungFehler(null);
    setEinladungErfolg(null);

    try {
      const { data, error, response } = await apiClient.POST('/v1/workouts/{id}/einladungen', {
        params: { path: { id: workout.id } },
        body: { benutzername: gefundenerBenutzer.benutzername },
      });

      if (response.status === 401) {
        setDialogOffen(false);
        await onSitzungAbgelaufen();
        return;
      }

      if ((response.status === 201 || response.ok) && data) {
        onEinladungenAktualisiert([...einladungen, data]);
        setEinladungErfolg(`„${data.eingeladenerBenutzername}“ wurde zu diesem Workout eingeladen.`);
        setDialogOffen(false);
        setSuchEingabe('');
        setGefundenerBenutzer(null);
        return;
      }

      setSuchFehler(
        extrahiereFehlermeldung(error, 'Einladung konnte nicht erstellt werden.', response),
      );
    } catch (ex) {
      setSuchFehler(
        extrahiereFehlermeldung(
          ex,
          'Einladung konnte wegen eines Netzwerkfehlers nicht erstellt werden.',
        ),
      );
    } finally {
      setLaedtEin(false);
    }
  };

  const handleEinladungEntfernen = async (einladung: WorkoutEinladungV1) => {
    setEntferntId(einladung.eingeladenerId);
    setEinladungFehler(null);
    setEinladungErfolg(null);

    try {
      const { error, response } = await apiClient.DELETE(
        '/v1/workouts/{id}/einladungen/{eingeladenerId}',
        {
          params: {
            path: {
              id: workout.id,
              eingeladenerId: einladung.eingeladenerId,
            },
          },
        },
      );

      if (response.status === 401) {
        await onSitzungAbgelaufen();
        return;
      }

      if (response.status === 204 || response.ok) {
        onEinladungenAktualisiert(
          einladungen.filter((e) => e.eingeladenerId !== einladung.eingeladenerId),
        );
        setEinladungErfolg(
          `Einladung für „${einladung.eingeladenerBenutzername}“ wurde entfernt.`,
        );
        return;
      }

      setEinladungFehler(
        extrahiereFehlermeldung(error, 'Einladung konnte nicht entfernt werden.', response),
      );
    } catch (ex) {
      setEinladungFehler(
        extrahiereFehlermeldung(
          ex,
          'Einladung konnte wegen eines Netzwerkfehlers nicht entfernt werden.',
        ),
      );
    } finally {
      setEntferntId(null);
    }
  };

  return (
    <Card>
      <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
        <Stack spacing={2.5}>
          <Stack spacing={1}>
            <Typography variant="h3" component="h2">
              Sichtbarkeit &amp; Einladungen
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Private Workouts sind nur für dich und eingeladene Benutzer sichtbar. Öffentliche
              Workouts erscheinen für alle angemeldeten Benutzer in deinem Profil.
            </Typography>
          </Stack>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            sx={{ alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between' }}
          >
            <ToggleButtonGroup
              exclusive
              value={workout.sichtbarkeit}
              onChange={(event, wert: Sichtbarkeit | null) =>
                void handleSichtbarkeitAendern(event, wert)
              }
              aria-label="Workout-Sichtbarkeit"
              disabled={sichtbarkeitSpeichert}
            >
              <ToggleButton value="PRIVAT" sx={{ gap: 1, minHeight: 44, px: 2 }}>
                <LockOutlinedIcon fontSize="small" />
                Privat
              </ToggleButton>
              <ToggleButton value="OEFFENTLICH" sx={{ gap: 1, minHeight: 44, px: 2 }}>
                <PublicOutlinedIcon fontSize="small" />
                Öffentlich
              </ToggleButton>
            </ToggleButtonGroup>

            <Button
              variant="outlined"
              startIcon={<PersonAddAlt1OutlinedIcon />}
              onClick={() => {
                setSuchEingabe('');
                setSuchFehler(null);
                setGefundenerBenutzer(null);
                setDialogOffen(true);
              }}
              sx={{ minHeight: 44 }}
            >
              Benutzer einladen
            </Button>
          </Stack>

          {sichtbarkeitFehler ? (
            <Alert severity="error" onClose={() => setSichtbarkeitFehler(null)}>
              {sichtbarkeitFehler}
            </Alert>
          ) : null}

          <Divider />

          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Eingeladene Benutzer
              </Typography>
              <Chip size="small" label={String(einladungen.length)} variant="outlined" />
            </Stack>

            {einladungFehler ? (
              <Alert severity="error" onClose={() => setEinladungFehler(null)}>
                {einladungFehler}
              </Alert>
            ) : null}

            {einladungErfolg ? (
              <Alert severity="success" onClose={() => setEinladungErfolg(null)}>
                {einladungErfolg}
              </Alert>
            ) : null}

            {einladungen.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Noch niemand eingeladen. Lade gezielt Benutzer per exaktem Benutzernamen ein.
              </Typography>
            ) : (
              <List disablePadding aria-label="Eingeladene Benutzer">
                {einladungen.map((einladung, index) => (
                  <ListItem
                    key={einladung.id}
                    disableGutters
                    divider={index < einladungen.length - 1}
                    sx={{ py: 1 }}
                  >
                    <Stack
                      direction="row"
                      spacing={1.5}
                      sx={{
                        width: '100%',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          variant="subtitle2"
                          sx={{ fontWeight: 600, wordBreak: 'break-word' }}
                        >
                          {einladung.eingeladenerBenutzername}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Eingeladen am {formatiereDatum(einladung.erstelltAm)}
                        </Typography>
                      </Box>

                      <Tooltip title="Einladung entfernen">
                        <span>
                          <IconButton
                            color="error"
                            aria-label={`Einladung für ${einladung.eingeladenerBenutzername} entfernen`}
                            disabled={entferntId === einladung.eingeladenerId}
                            onClick={() => void handleEinladungEntfernen(einladung)}
                          >
                            <DeleteOutlineOutlinedIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  </ListItem>
                ))}
              </List>
            )}
          </Stack>
        </Stack>
      </CardContent>

      <Dialog
        open={dialogOffen}
        onClose={schliesseDialog}
        fullWidth
        maxWidth="xs"
        aria-labelledby={dialogTitelId}
      >
        <DialogTitle id={dialogTitelId}>Benutzer einladen</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <DialogContentText>
              Suche nach dem exakten Benutzernamen. Prüfe den gefundenen Namen, bevor du die
              Einladung absendest.
            </DialogContentText>

            <Box component="form" noValidate onSubmit={(e) => void handleBenutzerSuchen(e)}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <TextField
                  autoFocus
                  fullWidth
                  id="einladung-benutzername"
                  label="Benutzername (exakt)"
                  value={suchEingabe}
                  onChange={(e) => {
                    setSuchEingabe(e.target.value);
                    setGefundenerBenutzer(null);
                    if (suchFehler) {
                      setSuchFehler(null);
                    }
                  }}
                  disabled={sucht || laedtEin}
                />
                <Button
                  type="submit"
                  variant="outlined"
                  startIcon={<SearchOutlinedIcon />}
                  disabled={sucht || laedtEin}
                  sx={{ whiteSpace: 'nowrap', minHeight: 56, flexShrink: 0, px: 2.5 }}
                >
                  {sucht ? 'Sucht …' : 'Suchen'}
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
                <Stack spacing={1}>
                  <Typography variant="caption" color="text.secondary">
                    Gefundener Benutzer
                  </Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, wordBreak: 'break-word' }}>
                    {gefundenerBenutzer.benutzername}
                  </Typography>
                </Stack>
              </Paper>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={schliesseDialog} disabled={laedtEin} sx={{ minHeight: 44 }}>
            Abbrechen
          </Button>
          <Button
            variant="contained"
            startIcon={<PersonAddAlt1OutlinedIcon />}
            disabled={!gefundenerBenutzer || laedtEin}
            onClick={() => void handleEinladen()}
            sx={{ minHeight: 44 }}
          >
            {laedtEin ? 'Lädt ein …' : 'Einladen'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
