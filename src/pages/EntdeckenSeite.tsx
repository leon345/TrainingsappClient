import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export function EntdeckenSeite() {
  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h1" gutterBottom>
          Entdecken
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Geteilte Workouts und Einladungen anderer angemeldeten Benutzer ansehen.
        </Typography>
      </Box>

      <Card>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
            <Chip icon={<ExploreOutlinedIcon />} label="In Vorbereitung" color="info" />
            <Typography variant="h3">Einladungen &amp; öffentliche Profile</Typography>
            <Typography variant="body1" color="text.secondary">
              Öffentliche Workouts und persönliche Einladungen sind nur für angemeldete Benutzer
              sichtbar. Neue Workouts sind standardmäßig privat.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
