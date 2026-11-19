import FitnessCenterOutlinedIcon from '@mui/icons-material/FitnessCenterOutlined';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export function WorkoutsSeite() {
  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h1" gutterBottom>
          Workouts
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Kraft- und Calisthenics-Workouts mit Übungen, Sätzen und Fortschritt erfassen.
        </Typography>
      </Box>

      <Card>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
            <Chip icon={<FitnessCenterOutlinedIcon />} label="In Vorbereitung" color="secondary" />
            <Typography variant="h3">Deine Trainingshistorie</Typography>
            <Typography variant="body1" color="text.secondary">
              Hier verwaltest du zukünftig deine eigenen Kraft- und Calisthenics-Workouts inklusive
              Varianten, Wiederholungen, Zeitdauern, Zusatzgewicht und Sichtbarkeit (privat oder
              öffentlich).
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
