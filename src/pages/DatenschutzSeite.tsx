import PrivacyTipOutlinedIcon from '@mui/icons-material/PrivacyTipOutlined';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { formatiereDatum } from '../format/datum';

export function DatenschutzSeite() {
  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h1" gutterBottom>
          Datenschutz &amp; PoC-Hinweis
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Informationen zum Proof-of-Concept-Status und den Datenschutzgrundsätzen dieser App.
        </Typography>
      </Box>

      <Alert severity="warning" sx={{ borderRadius: '16px' }}>
        <AlertTitle>Proof of Concept</AlertTitle>
        Proof of Concept – vollständig KI-generiert („vibe-coded“). Keine Gewähr für Sicherheit oder
        Verfügbarkeit. Daten können jederzeit zurückgesetzt werden. Bitte keine sensiblen Angaben
        eintragen.
      </Alert>

      <Card>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={2}>
            <Box>
              <Chip
                icon={<PrivacyTipOutlinedIcon />}
                label={`Stand: ${formatiereDatum('2026-11-19')}`}
                variant="outlined"
              />
            </Box>
            <Typography variant="h3">Datenschutzgrundsätze (DSGVO)</Typography>
            <Typography variant="body1" color="text.secondary">
              Die Trainingsapp verzichtet vollständig auf Tracking, Analyse-Dienste, Werbung und
              externe CDNs. Schriftarten (Roboto) und Icons werden direkt von dieser Anwendung
              ausgeliefert.
            </Typography>
            <Divider />
            <Typography variant="body2" color="text.secondary">
              Datenminimierung und Standard-Sichtbarkeit „privat“ gelten projektweit. Funktionen für
              vollständigen JSON-Datenexport und sofortige Kontolöschung werden im Zuge der
              Kontoverwaltung bereitgestellt.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
