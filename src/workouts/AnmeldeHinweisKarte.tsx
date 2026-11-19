import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router';

export interface AnmeldeHinweisKarteProps {
  readonly beschreibung: string;
  readonly fehlerMeldung?: string | null;
}

export function AnmeldeHinweisKarte({ beschreibung, fehlerMeldung }: AnmeldeHinweisKarteProps) {
  return (
    <Stack spacing={2.5}>
      {fehlerMeldung ? <Alert severity="warning">{fehlerMeldung}</Alert> : null}
      <Card>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
            <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
              <LockOutlinedIcon color="primary" />
              <Typography variant="h3">Anmeldung erforderlich</Typography>
            </Stack>
            <Typography variant="body1" color="text.secondary">
              {beschreibung}
            </Typography>
            <Button
              component={RouterLink}
              to="/konto"
              variant="contained"
              size="large"
              sx={{ minHeight: 48 }}
            >
              Zum Konto &amp; Anmelden
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
