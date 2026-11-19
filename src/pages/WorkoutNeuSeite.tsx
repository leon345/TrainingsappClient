import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router';
import {
  extrahiereFehlermeldung,
  istWorkoutV1,
  type WorkoutErstellenV1,
} from '../api/client';
import { useAuth } from '../konto/AuthContext';
import { AnmeldeHinweisKarte } from '../workouts/AnmeldeHinweisKarte';
import { erstelleLeeresWorkoutFormular } from '../workouts/formularLogik';
import { WorkoutFormular } from '../workouts/WorkoutFormular';

export function WorkoutNeuSeite() {
  const { status, fehlerMeldung: authFehler, apiClient, aktualisiereSitzung } = useAuth();
  const navigate = useNavigate();

  const [initialZustand] = useState(() => erstelleLeeresWorkoutFormular());
  const [speichert, setSpeichert] = useState(false);
  const [serverFehler, setServerFehler] = useState<string | null>(null);

  const beimAbsenden = async (body: WorkoutErstellenV1) => {
    setSpeichert(true);
    setServerFehler(null);

    try {
      const { data, error, response } = await apiClient.POST('/v1/workouts', { body });

      if (response.status === 401) {
        await aktualisiereSitzung();
        return;
      }

      if ((response.status === 201 || response.ok) && istWorkoutV1(data)) {
        void navigate(`/workouts/${data.id}`, {
          state: { hinweis: 'Workout wurde erstellt.' },
        });
        return;
      }

      setServerFehler(
        extrahiereFehlermeldung(error, 'Workout konnte nicht gespeichert werden.', response),
      );
    } catch (ex) {
      setServerFehler(
        extrahiereFehlermeldung(
          ex,
          'Workout konnte wegen eines Netzwerkfehlers nicht gespeichert werden.',
        ),
      );
    } finally {
      setSpeichert(false);
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
        <Typography variant="h1" gutterBottom>
          Neues Workout
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Erfasse ein Kraft- oder Calisthenics-Workout mit Übungen, Varianten und Sätzen.
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
          beschreibung="Melde dich mit deinem Passkey an, um ein neues Workout anzulegen."
          fehlerMeldung={status === 'fehler' ? authFehler : null}
        />
      ) : (
        <WorkoutFormular
          initialZustand={initialZustand}
          absendenLabel="Workout speichern"
          speichert={speichert}
          serverFehler={serverFehler}
          abbrechenZiel="/workouts"
          onAbsenden={beimAbsenden}
        />
      )}
    </Stack>
  );
}
