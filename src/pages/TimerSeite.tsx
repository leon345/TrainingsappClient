import PauseCircleOutlinedIcon from '@mui/icons-material/PauseCircleOutlined';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { dauerAlsWorte, formatiereDauer } from '../format/dauer';

const STANDARD_TRAINING_SEKUNDEN = 30;
const STANDARD_PAUSE_SEKUNDEN = 10;

export function TimerSeite() {
  const anzeige = formatiereDauer(STANDARD_TRAINING_SEKUNDEN);
  const anzeigeWorte = dauerAlsWorte(STANDARD_TRAINING_SEKUNDEN);

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

      <Card>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={3} sx={{ alignItems: 'center', textAlign: 'center' }}>
            <Chip
              icon={<TimerOutlinedIcon />}
              label="Standard-Intervall (Vorschau)"
              color="primary"
              variant="outlined"
            />

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
                value={75}
                size={220}
                thickness={3.2}
                color="primary"
                aria-label={`Intervalltimer Vorschau: ${anzeigeWorte}`}
              />
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography
                  component="p"
                  aria-label={anzeigeWorte}
                  sx={{
                    fontSize: '3rem',
                    fontWeight: 700,
                    lineHeight: 1.1,
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '-0.03em',
                  }}
                >
                  {anzeige}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Trainingsphase
                </Typography>
              </Box>
            </Box>

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              sx={{ justifyContent: 'center', alignItems: 'center' }}
            >
              <Chip
                icon={<PlayArrowRoundedIcon />}
                label={`Training: ${formatiereDauer(STANDARD_TRAINING_SEKUNDEN)}`}
                color="primary"
              />
              <Chip
                icon={<PauseCircleOutlinedIcon />}
                label={`Pause: ${formatiereDauer(STANDARD_PAUSE_SEKUNDEN)}`}
                color="secondary"
              />
            </Stack>

            <Alert severity="info" sx={{ width: '100%', textAlign: 'left', borderRadius: 4 }}>
              Der vollständige Intervalltimer mit Zeitstempel-Genauigkeit, Ton- und Vibrationssignalen
              sowie Server-Abgleich folgt im nächsten Entwicklungsschritt.
            </Alert>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
