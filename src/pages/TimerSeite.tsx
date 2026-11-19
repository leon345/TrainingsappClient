import FitnessCenterOutlinedIcon from '@mui/icons-material/FitnessCenterOutlined';
import PauseCircleOutlinedIcon from '@mui/icons-material/PauseCircleOutlined';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import VibrationOutlinedIcon from '@mui/icons-material/VibrationOutlined';
import VolumeUpOutlinedIcon from '@mui/icons-material/VolumeUpOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import { istTimerEinstellungV1 } from '../api/client';
import { dauerAlsWorte, formatiereDauer } from '../format/dauer';
import { useAuth } from '../konto/AuthContext';
import {
  berechneFortschrittProzent,
  bereinigeEinstellung,
  istTimerAktiv,
  MAX_PAUSE_SEKUNDEN,
  MAX_TRAINING_SEKUNDEN,
  MIN_PAUSE_SEKUNDEN,
  MIN_TRAINING_SEKUNDEN,
  restSekundenAnzeige,
  type TimerEinstellung,
  type TimerZustand,
} from '../timer/logik';
import { useIntervallTimer, type IntervallTimerOptionen } from '../timer/useIntervallTimer';
import { POC_HINWEIS_TEXT } from './DatenschutzSeite';

export interface TimerSeiteProps {
  readonly timerOptionen?: IntervallTimerOptionen;
}

function phasenDarstellung(zustand: TimerZustand) {
  switch (zustand.phase) {
    case 'training':
      return {
        statusText: `Training – Runde ${zustand.runde}`,
        untertitel: `Trainingsphase · Runde ${zustand.runde}`,
        farbe: 'primary' as const,
        rahmenFarbe: 'primary.main',
        chipVariante: 'filled' as const,
        icon: <FitnessCenterOutlinedIcon />,
      };
    case 'pause':
      return {
        statusText: `Pause – Runde ${zustand.runde}`,
        untertitel: `Pausenphase · Runde ${zustand.runde}`,
        farbe: 'secondary' as const,
        rahmenFarbe: 'secondary.main',
        chipVariante: 'filled' as const,
        icon: <PauseCircleOutlinedIcon />,
      };
    case 'pausiert': {
      const vorher = zustand.pausiertePhase === 'pause' ? 'Pause' : 'Training';
      return {
        statusText: `Pausiert – ${vorher}, Runde ${zustand.runde}`,
        untertitel: `Pausiert · Runde ${zustand.runde}`,
        farbe: 'info' as const,
        rahmenFarbe: 'info.main',
        chipVariante: 'filled' as const,
        icon: <PauseCircleOutlinedIcon />,
      };
    }
    case 'bereit':
    default:
      return {
        statusText: 'Bereit',
        untertitel: 'Trainingsphase',
        farbe: 'primary' as const,
        rahmenFarbe: 'divider',
        chipVariante: 'outlined' as const,
        icon: <TimerOutlinedIcon />,
      };
  }
}

export function TimerSeite({ timerOptionen }: TimerSeiteProps = {}) {
  const { benutzer, status: authStatus, apiClient } = useAuth();
  const [syncHinweis, setSyncHinweis] = useState<string | null>(null);
  const putZaehlerRef = useRef<number>(0);

  const synchronisiereEinstellungZumServer = useCallback(
    (einstellung: TimerEinstellung) => {
      if (authStatus !== 'angemeldet' || !benutzer) {
        return;
      }
      const anfrageId = ++putZaehlerRef.current;
      void (async () => {
        try {
          const { response } = await apiClient.PUT('/v1/timer/einstellung', {
            body: {
              trainingSekunden: einstellung.trainingSekunden,
              pauseSekunden: einstellung.pauseSekunden,
            },
          });
          if (anfrageId !== putZaehlerRef.current) {
            return;
          }
          if (response.ok) {
            setSyncHinweis(null);
          } else if (response.status !== 401) {
            setSyncHinweis(
              'Timer-Einstellung wurde lokal gespeichert, konnte aber nicht mit dem Server synchronisiert werden.',
            );
          }
        } catch {
          if (anfrageId !== putZaehlerRef.current) {
            return;
          }
          setSyncHinweis(
            'Timer-Einstellung wurde lokal gespeichert, konnte aber offline nicht mit dem Server synchronisiert werden.',
          );
        }
      })();
    },
    [authStatus, benutzer, apiClient],
  );

  const {
    zustand,
    signale,
    vibrationUnterstuetzt,
    starten,
    pausieren,
    fortsetzen,
    zuruecksetzen,
    einstellungAendern,
    uebernehmeExterneEinstellung,
    setzeTonAktiv,
    setzeVibrationAktiv,
  } = useIntervallTimer({
    ...timerOptionen,
    beiEinstellungGeaendert: (einstellung) => {
      timerOptionen?.beiEinstellungGeaendert?.(einstellung);
      synchronisiereEinstellungZumServer(einstellung);
    },
  });

  const [trainingEingabe, setTrainingEingabe] = useState<string>(() =>
    String(zustand.einstellung.trainingSekunden),
  );
  const [pauseEingabe, setPauseEingabe] = useState<string>(() =>
    String(zustand.einstellung.pauseSekunden),
  );

  const angemeldeteBenutzerId = authStatus === 'angemeldet' && benutzer ? benutzer.id : null;

  useEffect(() => {
    if (!angemeldeteBenutzerId) {
      return;
    }

    let aktiv = true;
    const ladeVomServer = async () => {
      try {
        const { data, response } = await apiClient.GET('/v1/timer/einstellung');
        if (!aktiv) {
          return;
        }
        if (response.ok && istTimerEinstellungV1(data)) {
          setSyncHinweis(null);
          if (data.gespeichert) {
            const bereinigt = bereinigeEinstellung({
              trainingSekunden: data.trainingSekunden,
              pauseSekunden: data.pauseSekunden,
            });
            uebernehmeExterneEinstellung(bereinigt);
            setTrainingEingabe(String(bereinigt.trainingSekunden));
            setPauseEingabe(String(bereinigt.pauseSekunden));
          }
          return;
        }
        if (response.status !== 401) {
          setSyncHinweis(
            'Gespeicherte Timer-Einstellung konnte nicht vom Server geladen werden. Lokale Werte bleiben aktiv.',
          );
        }
      } catch {
        if (!aktiv) {
          return;
        }
        setSyncHinweis(
          'Timer-Einstellung konnte offline nicht vom Server geladen werden. Lokale Werte bleiben aktiv.',
        );
      }
    };

    void ladeVomServer();
    return () => {
      aktiv = false;
    };
  }, [angemeldeteBenutzerId, apiClient, uebernehmeExterneEinstellung]);

  const restSekunden = restSekundenAnzeige(zustand);
  const zeitText = formatiereDauer(restSekunden);
  const zeitWorte = dauerAlsWorte(restSekunden);
  const fortschrittProzent = berechneFortschrittProzent(zustand);
  const darstellung = phasenDarstellung(zustand);
  const laeuft = istTimerAktiv(zustand);

  const uebernehmeTrainingEingabe = (rohWert: string) => {
    const getrimmt = rohWert.trim();
    if (getrimmt === '') {
      setTrainingEingabe(String(zustand.einstellung.trainingSekunden));
      return;
    }
    const zahl = Number(getrimmt);
    if (!Number.isFinite(zahl)) {
      setTrainingEingabe(String(zustand.einstellung.trainingSekunden));
      return;
    }
    const bereinigt = bereinigeEinstellung({
      trainingSekunden: zahl,
      pauseSekunden: zustand.einstellung.pauseSekunden,
    });
    einstellungAendern({ trainingSekunden: bereinigt.trainingSekunden });
    setTrainingEingabe(String(bereinigt.trainingSekunden));
  };

  const uebernehmePauseEingabe = (rohWert: string) => {
    const getrimmt = rohWert.trim();
    if (getrimmt === '') {
      setPauseEingabe(String(zustand.einstellung.pauseSekunden));
      return;
    }
    const zahl = Number(getrimmt);
    if (!Number.isFinite(zahl)) {
      setPauseEingabe(String(zustand.einstellung.pauseSekunden));
      return;
    }
    const bereinigt = bereinigeEinstellung({
      trainingSekunden: zustand.einstellung.trainingSekunden,
      pauseSekunden: zahl,
    });
    einstellungAendern({ pauseSekunden: bereinigt.pauseSekunden });
    setPauseEingabe(String(bereinigt.pauseSekunden));
  };

  const beiTrainingAenderung = (event: ChangeEvent<HTMLInputElement>) => {
    const wert = event.target.value;
    setTrainingEingabe(wert);
    const getrimmt = wert.trim();
    if (getrimmt === '') {
      return;
    }
    const zahl = Number(getrimmt);
    if (
      Number.isInteger(zahl) &&
      zahl >= MIN_TRAINING_SEKUNDEN &&
      zahl <= MAX_TRAINING_SEKUNDEN
    ) {
      einstellungAendern({ trainingSekunden: zahl });
    }
  };

  const beiPauseAenderung = (event: ChangeEvent<HTMLInputElement>) => {
    const wert = event.target.value;
    setPauseEingabe(wert);
    const getrimmt = wert.trim();
    if (getrimmt === '') {
      return;
    }
    const zahl = Number(getrimmt);
    if (Number.isInteger(zahl) && zahl >= MIN_PAUSE_SEKUNDEN && zahl <= MAX_PAUSE_SEKUNDEN) {
      einstellungAendern({ pauseSekunden: zahl });
    }
  };

  const beiEnterTaste =
    (uebernehmen: (wert: string) => void, aktuellerWert: string) =>
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        uebernehmen(aktuellerWert);
      }
    };

  const beiStartKlick = () => {
    uebernehmeTrainingEingabe(trainingEingabe);
    uebernehmePauseEingabe(pauseEingabe);
    starten();
  };

  const zeitGroesse = zeitText.length > 5 ? '2.25rem' : '3rem';

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h1" gutterBottom>
          Intervalltimer
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Trainings- und Pausenphasen im Blick – lokal nutzbar und beim Tab-Wechsel dauerhaft aktiv.
        </Typography>
      </Box>

      <Card
        sx={{
          borderColor: darstellung.rahmenFarbe,
          borderWidth: zustand.phase === 'bereit' ? 1 : 2,
        }}
      >
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={3} sx={{ alignItems: 'center', textAlign: 'center' }}>
            {/* Sichtbares Phasensignal mit aria-live="polite" – ändert sich nur bei Phasenwechsel */}
            <Box role="status" aria-live="polite" aria-atomic="true">
              <Chip
                icon={darstellung.icon}
                label={darstellung.statusText}
                color={darstellung.farbe}
                variant={darstellung.chipVariante}
                sx={{ px: 1, fontSize: '0.95rem', height: 36 }}
              />
            </Box>

            <Box
              sx={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 220,
                height: 220,
              }}
            >
              <CircularProgress
                variant="determinate"
                value={100}
                size={220}
                thickness={3.2}
                sx={{
                  color: 'divider',
                  position: 'absolute',
                }}
                aria-hidden="true"
              />
              <CircularProgress
                variant="determinate"
                value={fortschrittProzent}
                size={220}
                thickness={3.2}
                color={darstellung.farbe}
                aria-hidden="true"
              />
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  px: 2,
                }}
              >
                <Typography
                  component="p"
                  role="timer"
                  aria-label={zeitWorte}
                  sx={{
                    fontSize: zeitGroesse,
                    fontWeight: 700,
                    lineHeight: 1.1,
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '-0.03em',
                  }}
                >
                  {zeitText}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                  {darstellung.untertitel}
                </Typography>
              </Box>
            </Box>

            <Stack
              direction="row"
              spacing={1.5}
              useFlexGap
              sx={{
                flexWrap: 'wrap',
                justifyContent: 'center',
                width: '100%',
              }}
            >
              {zustand.phase === 'bereit' ? (
                <Button
                  variant="contained"
                  size="large"
                  color="primary"
                  startIcon={<PlayArrowRoundedIcon />}
                  onClick={beiStartKlick}
                  sx={{ minWidth: 148 }}
                >
                  Start
                </Button>
              ) : null}

              {laeuft ? (
                <Button
                  variant="contained"
                  size="large"
                  color={darstellung.farbe}
                  startIcon={<PauseRoundedIcon />}
                  onClick={pausieren}
                  sx={{ minWidth: 148 }}
                >
                  Pause
                </Button>
              ) : null}

              {zustand.phase === 'pausiert' ? (
                <Button
                  variant="contained"
                  size="large"
                  color="primary"
                  startIcon={<PlayArrowRoundedIcon />}
                  onClick={fortsetzen}
                  sx={{ minWidth: 148 }}
                >
                  Fortsetzen
                </Button>
              ) : null}

              <Button
                variant="outlined"
                size="large"
                startIcon={<ReplayRoundedIcon />}
                onClick={zuruecksetzen}
                disabled={zustand.phase === 'bereit'}
                sx={{ minWidth: 148 }}
              >
                Zurücksetzen
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
          <Stack spacing={3}>
            <Box>
              <Typography variant="h3" component="h2" gutterBottom>
                Intervalle einstellen
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Alle Zeitdauern in ganzen Sekunden. Pause 0 wechselt direkt zur nächsten
                Trainingsrunde.
              </Typography>
            </Box>

            {angemeldeteBenutzerId && syncHinweis ? (
              <Alert severity="warning" onClose={() => setSyncHinweis(null)}>
                {syncHinweis}
              </Alert>
            ) : null}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                id="timer-training-sekunden"
                label="Training (Sekunden)"
                type="number"
                fullWidth
                value={trainingEingabe}
                onChange={beiTrainingAenderung}
                onBlur={() => uebernehmeTrainingEingabe(trainingEingabe)}
                onKeyDown={beiEnterTaste(uebernehmeTrainingEingabe, trainingEingabe)}
                helperText={`Dauer: ${formatiereDauer(zustand.einstellung.trainingSekunden)} · Bereich 1–86400 s`}
                slotProps={{
                  htmlInput: {
                    min: MIN_TRAINING_SEKUNDEN,
                    max: MAX_TRAINING_SEKUNDEN,
                    step: 1,
                    inputMode: 'numeric',
                  },
                }}
              />

              <TextField
                id="timer-pause-sekunden"
                label="Pause (Sekunden)"
                type="number"
                fullWidth
                value={pauseEingabe}
                onChange={beiPauseAenderung}
                onBlur={() => uebernehmePauseEingabe(pauseEingabe)}
                onKeyDown={beiEnterTaste(uebernehmePauseEingabe, pauseEingabe)}
                helperText={
                  zustand.einstellung.pauseSekunden === 0
                    ? 'Keine Pause · direkt nächste Runde'
                    : `Dauer: ${formatiereDauer(zustand.einstellung.pauseSekunden)} · Bereich 0–86400 s`
                }
                slotProps={{
                  htmlInput: {
                    min: MIN_PAUSE_SEKUNDEN,
                    max: MAX_PAUSE_SEKUNDEN,
                    step: 1,
                    inputMode: 'numeric',
                  },
                }}
              />
            </Stack>

            <Divider />

            <Stack spacing={1.5}>
              <Typography variant="h3" component="h2">
                Phasensignale
              </Typography>

              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={signale.tonAktiv}
                      onChange={(_, aktiv) => setzeTonAktiv(aktiv)}
                    />
                  }
                  label={
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <VolumeUpOutlinedIcon fontSize="small" color="action" />
                      <span>Ton bei Phasenwechsel</span>
                    </Stack>
                  }
                />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', pl: 7 }}
                >
                  Training: 2× 880 Hz (120 ms) · Pause: 1× 440 Hz (200 ms)
                </Typography>
              </Box>

              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={vibrationUnterstuetzt && signale.vibrationAktiv}
                      disabled={!vibrationUnterstuetzt}
                      onChange={(_, aktiv) => setzeVibrationAktiv(aktiv)}
                      slotProps={{
                        input: {
                          'aria-describedby': 'timer-vibration-hinweis',
                        },
                      }}
                    />
                  }
                  label={
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <VibrationOutlinedIcon fontSize="small" color="action" />
                      <span>Vibration bei Phasenwechsel</span>
                    </Stack>
                  }
                />
                <Typography
                  id="timer-vibration-hinweis"
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', pl: 7 }}
                >
                  {vibrationUnterstuetzt
                    ? 'Training: 1× kurz (200 ms) · Pause: 3× kurz'
                    : 'Vibration wird von diesem Browser oder Gerät nicht unterstützt.'}
                </Typography>
              </Box>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Alert severity="info" sx={{ borderRadius: '16px' }}>
        {POC_HINWEIS_TEXT}
      </Alert>
    </Stack>
  );
}
