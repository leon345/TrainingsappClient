import PrivacyTipOutlinedIcon from '@mui/icons-material/PrivacyTipOutlined';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router';
import { formatiereDatum } from '../format/datum';

export const POC_HINWEIS_TEXT =
  'Proof of Concept – vollständig KI-generiert („vibe-coded“). Keine Gewähr für Sicherheit oder Verfügbarkeit. Daten können jederzeit zurückgesetzt werden. Bitte keine sensiblen Angaben eintragen.';

export function DatenschutzSeite() {
  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h1" gutterBottom>
          Datenschutz &amp; PoC-Hinweis
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Datenschutzerklärung, rechtliche Hinweise und Informationen zum Proof-of-Concept-Status
          dieser Anwendung.
        </Typography>
      </Box>

      <Alert severity="warning" sx={{ borderRadius: '16px' }}>
        <AlertTitle>Proof of Concept</AlertTitle>
        {POC_HINWEIS_TEXT}
      </Alert>

      <Card>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={2.5}>
            <Box>
              <Chip
                icon={<PrivacyTipOutlinedIcon />}
                label={`Stand: ${formatiereDatum('2026-11-19')}`}
                variant="outlined"
              />
            </Box>

            <Box>
              <Typography variant="h3" component="h2" gutterBottom>
                1. Verantwortlicher &amp; Impressum
              </Typography>
              <Typography variant="body1" color="text.secondary">
                [Verantwortlicher / Impressum vom Betreiber einzutragen]
              </Typography>
            </Box>

            <Divider />

            <Box>
              <Typography variant="h3" component="h2" gutterBottom>
                2. Hosting, Infrastruktur &amp; Datensparsamkeit
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Die Anwendung und Datenbank werden in Deutschland bei Strato (EU) betrieben. Die
                Trainingsapp verzichtet vollständig auf Tracking, Analyse-Dienste, Werbung und
                externe CDNs. Schriftarten (Roboto) und Icons werden direkt von dieser Anwendung
                ausgeliefert. Der Intervalltimer funktioniert vollständig lokal ohne Konto.
              </Typography>
            </Box>

            <Divider />

            <Box>
              <Typography variant="h3" component="h2" gutterBottom>
                3. Passwortlose Anmeldung per Passkey (WebAuthn)
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Die Anmeldung erfolgt ausschließlich passwortlos per Passkey (WebAuthn). Es werden
                weder Passwörter noch E-Mail-Adressen oder Klarnamen erhoben – bitte wähle bei der
                Registrierung ein Pseudonym. Gespeichert werden dein Benutzername, der Zeitpunkt
                deiner ausdrücklichen DSGVO-Einwilligung sowie Passkey-Metadaten (öffentlicher
                Schlüssel, Bezeichnung, Erstellungsdatum und Datum der letzten Verwendung in UTC).
              </Typography>
            </Box>

            <Divider />

            <Box>
              <Typography variant="h3" component="h2" gutterBottom>
                4. Sichtbarkeit &amp; Teilen von Workouts
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Neue Workouts werden standardmäßig privat („Privat“) gespeichert und sind nur für
                dich sichtbar. Du kannst einzelne Workouts gezielt per Einladung (exakter
                Benutzername) teilen oder bewusst als „Öffentlich“ freigeben. Auch öffentliche
                Workouts sind ausschließlich für angemeldete Benutzer einsehbar.
              </Typography>
            </Box>

            <Divider />

            <Box>
              <Typography variant="h3" component="h2" gutterBottom>
                5. Speicherdauern &amp; automatische Bereinigung
              </Typography>
              <List dense disablePadding>
                <ListItem disableGutters>
                  <ListItemText
                    primary="Server-Logs: 14 Tage"
                    secondary="Technische Zugriffs- und Fehlerprotokolle werden nach 14 Tagen automatisch gelöscht."
                  />
                </ListItem>
                <ListItem disableGutters>
                  <ListItemText
                    primary="Datenbank-Backups: 30 Tage"
                    secondary="Sicherungen zur Wiederherstellung werden höchstens 30 Tage aufbewahrt und anschließend überschrieben."
                  />
                </ListItem>
                <ListItem disableGutters>
                  <ListItemText
                    primary="Unvollständige Registrierungen: 10 Minuten"
                    secondary="Nicht abgeschlossene Registrierungsanfragen werden nach 10 Minuten automatisch verworfen."
                  />
                </ListItem>
                <ListItem disableGutters>
                  <ListItemText
                    primary="Passkeylose Konten: 14 Tage"
                    secondary="Konten ohne hinterlegten Passkey werden nach 14 Tagen automatisch entfernt. Aktive Konten mit Passkey werden nicht automatisch gelöscht."
                  />
                </ListItem>
              </List>
            </Box>

            <Divider />

            <Box>
              <Typography variant="h3" component="h2" gutterBottom>
                6. Deine Rechte (Auskunft, Datenexport &amp; Kontolöschung)
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                Du kannst im Konto-Bereich jederzeit einen vollständigen JSON-Datenexport aller zu
                dir gespeicherten Daten (Profil, Passkey-Metadaten ohne kryptografische Schlüssel,
                Timer-Einstellung, Workouts und Einladungen) herunterladen sowie dein Konto samt
                aller gespeicherten Daten sofort und unwiderruflich löschen.
              </Typography>
              <Button component={RouterLink} to="/konto" variant="outlined" sx={{ minHeight: 44 }}>
                Zum Konto-Bereich
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
