import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export function KontoSeite() {
  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h1" gutterBottom>
          Konto
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Passwortlose Anmeldung und Verwaltung deiner Passkeys.
        </Typography>
      </Box>

      <Card>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
            <Chip icon={<KeyOutlinedIcon />} label="Passkeys" color="primary" />
            <Typography variant="h3">Anmeldung &amp; Passkey-Verwaltung</Typography>
            <Typography variant="body1" color="text.secondary">
              Die Registrierung und Anmeldung erfolgt ausschließlich per Passkey (WebAuthn) mit
              einem Pseudonym-Benutzernamen. Mehrere Passkeys lassen sich hier künftig hinzufügen,
              umbenennen und verwalten.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
