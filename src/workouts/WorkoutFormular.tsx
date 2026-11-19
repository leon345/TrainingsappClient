import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import ArrowDownwardOutlinedIcon from '@mui/icons-material/ArrowDownwardOutlined';
import ArrowUpwardOutlinedIcon from '@mui/icons-material/ArrowUpwardOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import FitnessCenterOutlinedIcon from '@mui/icons-material/FitnessCenterOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import SelfImprovementOutlinedIcon from '@mui/icons-material/SelfImprovementOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import FormHelperText from '@mui/material/FormHelperText';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useId, useState, type FormEvent } from 'react';
import { Link as RouterLink } from 'react-router';
import type { Sichtbarkeit, WorkoutErstellenV1, WorkoutTyp } from '../api/client';
import { dauerAlsWorte, formatiereDauer, MAX_DAUER_SEKUNDEN } from '../format/dauer';
import {
  entferneSatz,
  entferneUebung,
  erstelleLeerenSatz,
  erstelleLeereUebung,
  normalisiereSaetze,
  normalisiereUebungen,
  parseGanzeSekundenEingabe,
  UEBUNG_NAME_MAX_LAENGE,
  UEBUNG_VARIANTE_MAX_LAENGE,
  validiereWorkoutFormular,
  verschiebeSatz,
  verschiebeUebung,
  WORKOUT_NOTIZ_MAX_LAENGE,
  WORKOUT_TITEL_MAX_LAENGE,
  type SatzFormularEintrag,
  type UebungFormularEintrag,
  type WorkoutFormularFehler,
  type WorkoutFormularZustand,
} from './formularLogik';

export interface WorkoutFormularProps {
  readonly initialZustand: WorkoutFormularZustand;
  readonly absendenLabel: string;
  readonly speichert: boolean;
  readonly serverFehler?: string | null;
  readonly istVersionsKonflikt?: boolean;
  readonly onNeuLaden?: () => void;
  readonly abbrechenZiel?: string;
  readonly onAbbrechen?: () => void;
  readonly onAbsenden: (body: WorkoutErstellenV1) => Promise<void> | void;
}

const LEERE_FEHLER: WorkoutFormularFehler = { uebungen: {} };

function formatiereDauerVorschau(eingabe: string, min: number): {
  text: string;
  ariaLabel: string;
} | null {
  const sekunden = parseGanzeSekundenEingabe(eingabe, min, MAX_DAUER_SEKUNDEN);
  if (sekunden === null) {
    return null;
  }
  return {
    text: formatiereDauer(sekunden),
    ariaLabel: dauerAlsWorte(sekunden),
  };
}

export function WorkoutFormular({
  initialZustand,
  absendenLabel,
  speichert,
  serverFehler,
  istVersionsKonflikt = false,
  onNeuLaden,
  abbrechenZiel,
  onAbbrechen,
  onAbsenden,
}: WorkoutFormularProps) {
  const [formular, setFormular] = useState<WorkoutFormularZustand>(initialZustand);
  const [fehler, setFehler] = useState<WorkoutFormularFehler>(LEERE_FEHLER);
  const [hatValidierungsFehler, setHatValidierungsFehler] = useState(false);

  const idPraefix = useId();
  const workoutDauerVorschau = formatiereDauerVorschau(formular.dauerSekunden, 1);

  const aktualisiereFeld = <K extends keyof WorkoutFormularZustand>(
    feld: K,
    wert: WorkoutFormularZustand[K],
  ) => {
    setFormular((alt) => ({ ...alt, [feld]: wert }));
    if (hatValidierungsFehler) {
      setFehler((alt) => ({ ...alt, [feld]: undefined }));
    }
  };

  const uebungHinzufuegen = () => {
    setFormular((alt) => ({
      ...alt,
      uebungen: normalisiereUebungen([
        ...alt.uebungen,
        erstelleLeereUebung(alt.uebungen.length, true),
      ]),
    }));
  };

  const aktualisiereUebung = (
    clientId: string,
    aenderungen: Partial<Pick<UebungFormularEintrag, 'name' | 'variante'>>,
  ) => {
    setFormular((alt) => ({
      ...alt,
      uebungen: alt.uebungen.map((u) => (u.clientId === clientId ? { ...u, ...aenderungen } : u)),
    }));
  };

  const uebungVerschieben = (index: number, richtung: -1 | 1) => {
    setFormular((alt) => ({
      ...alt,
      uebungen: verschiebeUebung(alt.uebungen, index, richtung),
    }));
  };

  const uebungEntfernen = (clientId: string) => {
    setFormular((alt) => ({
      ...alt,
      uebungen: entferneUebung(alt.uebungen, clientId),
    }));
  };

  const satzHinzufuegen = (uebungClientId: string) => {
    setFormular((alt) => ({
      ...alt,
      uebungen: alt.uebungen.map((u) =>
        u.clientId === uebungClientId
          ? {
              ...u,
              saetze: normalisiereSaetze([...u.saetze, erstelleLeerenSatz(u.saetze.length)]),
            }
          : u,
      ),
    }));
  };

  const aktualisiereSatz = (
    uebungClientId: string,
    satzClientId: string,
    aenderungen: Partial<
      Pick<SatzFormularEintrag, 'wiederholungen' | 'dauerSekunden' | 'gewichtKg' | 'pauseSekunden'>
    >,
  ) => {
    setFormular((alt) => ({
      ...alt,
      uebungen: alt.uebungen.map((u) =>
        u.clientId === uebungClientId
          ? {
              ...u,
              saetze: u.saetze.map((s) =>
                s.clientId === satzClientId ? { ...s, ...aenderungen } : s,
              ),
            }
          : u,
      ),
    }));
  };

  const satzVerschieben = (uebungClientId: string, satzIndex: number, richtung: -1 | 1) => {
    setFormular((alt) => ({
      ...alt,
      uebungen: alt.uebungen.map((u) =>
        u.clientId === uebungClientId
          ? { ...u, saetze: verschiebeSatz(u.saetze, satzIndex, richtung) }
          : u,
      ),
    }));
  };

  const satzEntfernen = (uebungClientId: string, satzClientId: string) => {
    setFormular((alt) => ({
      ...alt,
      uebungen: alt.uebungen.map((u) =>
        u.clientId === uebungClientId
          ? { ...u, saetze: entferneSatz(u.saetze, satzClientId) }
          : u,
      ),
    }));
  };

  const beimAbsenden = async (ereignis: FormEvent<HTMLFormElement>) => {
    ereignis.preventDefault();
    const pruefung = validiereWorkoutFormular(formular);
    if (!pruefung.gueltig) {
      setFehler(pruefung.fehler);
      setHatValidierungsFehler(true);
      return;
    }

    setFehler(LEERE_FEHLER);
    setHatValidierungsFehler(false);
    await onAbsenden(pruefung.body);
  };

  return (
    <Box component="form" noValidate onSubmit={(e) => void beimAbsenden(e)}>
      <Stack spacing={3}>
        {serverFehler ? (
          <Alert
            severity="error"
            action={
              istVersionsKonflikt && onNeuLaden ? (
                <Button
                  color="inherit"
                  size="small"
                  startIcon={<RefreshOutlinedIcon />}
                  onClick={onNeuLaden}
                  sx={{ minHeight: 40, whiteSpace: 'nowrap' }}
                >
                  Neu laden
                </Button>
              ) : undefined
            }
          >
            {serverFehler}
          </Alert>
        ) : null}

        {hatValidierungsFehler ? (
          <Alert severity="error">
            Bitte prüfe die markierten Felder im Workout-Formular.
          </Alert>
        ) : null}

        <Card>
          <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
            <Stack spacing={2.5}>
              <Typography variant="h2">Grunddaten</Typography>

              <Box>
                <Typography
                  id={`${idPraefix}-typ-label`}
                  variant="subtitle2"
                  color="text.secondary"
                  sx={{ mb: 1 }}
                >
                  Workout-Typ
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  fullWidth
                  value={formular.typ}
                  onChange={(_, neuerTyp: WorkoutTyp | null) => {
                    if (neuerTyp) {
                      aktualisiereFeld('typ', neuerTyp);
                    }
                  }}
                  aria-labelledby={`${idPraefix}-typ-label`}
                >
                  <ToggleButton value="KRAFT" sx={{ minHeight: 48, gap: 1 }}>
                    <FitnessCenterOutlinedIcon fontSize="small" />
                    Kraft
                  </ToggleButton>
                  <ToggleButton value="CALISTHENICS" sx={{ minHeight: 48, gap: 1 }}>
                    <SelfImprovementOutlinedIcon fontSize="small" />
                    Calisthenics
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>

              <TextField
                id={`${idPraefix}-titel`}
                label="Titel"
                required
                fullWidth
                value={formular.titel}
                onChange={(e) => aktualisiereFeld('titel', e.target.value)}
                error={Boolean(fehler.titel)}
                helperText={fehler.titel ?? `${formular.titel.trim().length}/${WORKOUT_TITEL_MAX_LAENGE} Zeichen`}
                slotProps={{ htmlInput: { maxLength: WORKOUT_TITEL_MAX_LAENGE } }}
              />

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 2,
                }}
              >
                <TextField
                  id={`${idPraefix}-startzeit`}
                  label="Startzeit"
                  type="datetime-local"
                  required
                  fullWidth
                  value={formular.startZeitLokal}
                  onChange={(e) => aktualisiereFeld('startZeitLokal', e.target.value)}
                  error={Boolean(fehler.startZeitLokal)}
                  helperText={fehler.startZeitLokal ?? 'Lokale Startzeit des Workouts'}
                  slotProps={{ inputLabel: { shrink: true } }}
                />

                <TextField
                  id={`${idPraefix}-dauer`}
                  label="Dauer (Sekunden, optional)"
                  type="number"
                  fullWidth
                  value={formular.dauerSekunden}
                  onChange={(e) => aktualisiereFeld('dauerSekunden', e.target.value)}
                  error={Boolean(fehler.dauerSekunden)}
                  helperText={
                    fehler.dauerSekunden ? (
                      fehler.dauerSekunden
                    ) : workoutDauerVorschau ? (
                      <Box component="span">
                        Formatiert:{' '}
                        <Box component="span" aria-label={workoutDauerVorschau.ariaLabel}>
                          {workoutDauerVorschau.text}
                        </Box>
                      </Box>
                    ) : (
                      'Ganze Sekunden, z. B. 2700 für 45:00'
                    )
                  }
                  slotProps={{
                    htmlInput: {
                      inputMode: 'numeric',
                      min: 1,
                      max: MAX_DAUER_SEKUNDEN,
                      step: 1,
                    },
                  }}
                />
              </Box>

              <Box>
                <Typography
                  id={`${idPraefix}-sichtbarkeit-label`}
                  variant="subtitle2"
                  color="text.secondary"
                  sx={{ mb: 1 }}
                >
                  Sichtbarkeit
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  fullWidth
                  value={formular.sichtbarkeit}
                  onChange={(_, neueSichtbarkeit: Sichtbarkeit | null) => {
                    if (neueSichtbarkeit) {
                      aktualisiereFeld('sichtbarkeit', neueSichtbarkeit);
                    }
                  }}
                  aria-labelledby={`${idPraefix}-sichtbarkeit-label`}
                >
                  <ToggleButton value="PRIVAT" sx={{ minHeight: 48, gap: 1 }}>
                    <LockOutlinedIcon fontSize="small" />
                    Privat
                  </ToggleButton>
                  <ToggleButton value="OEFFENTLICH" sx={{ minHeight: 48, gap: 1 }}>
                    <PublicOutlinedIcon fontSize="small" />
                    Öffentlich
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>

              <TextField
                id={`${idPraefix}-notiz`}
                label="Notiz (optional)"
                multiline
                minRows={2}
                maxRows={5}
                fullWidth
                value={formular.notiz}
                onChange={(e) => aktualisiereFeld('notiz', e.target.value)}
                error={Boolean(fehler.notiz)}
                helperText={fehler.notiz ?? `${formular.notiz.trim().length}/${WORKOUT_NOTIZ_MAX_LAENGE} Zeichen`}
                slotProps={{ htmlInput: { maxLength: WORKOUT_NOTIZ_MAX_LAENGE } }}
              />
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
            <Stack spacing={2.5}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1.5}
                sx={{ justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' } }}
              >
                <Box>
                  <Typography variant="h2">Übungen</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Füge Übungen hinzu, sortiere sie per Pfeiltasten und erfasse einzelne Sätze.
                  </Typography>
                </Box>
                <Button
                  type="button"
                  variant="outlined"
                  startIcon={<AddOutlinedIcon />}
                  onClick={uebungHinzufuegen}
                  sx={{ minHeight: 48, whiteSpace: 'nowrap' }}
                >
                  Übung hinzufügen
                </Button>
              </Stack>

              {formular.uebungen.length === 0 ? (
                <Paper
                  variant="outlined"
                  sx={{ p: 2.5, textAlign: 'center', borderStyle: 'dashed', borderRadius: 3 }}
                >
                  <Typography variant="body2" color="text.secondary">
                    Noch keine Übungen hinzugefügt. Du kannst das Workout auch ohne Übungen speichern
                    oder jetzt eine Übung anlegen.
                  </Typography>
                </Paper>
              ) : (
                <Stack spacing={2.5}>
                  {formular.uebungen.map((uebung, uIndex) => {
                    const uebungFehler = fehler.uebungen[uebung.clientId];
                    const uebungNummer = uIndex + 1;

                    return (
                      <Paper
                        key={uebung.clientId}
                        variant="outlined"
                        sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 3 }}
                      >
                        <Stack spacing={2}>
                          <Stack
                            direction="row"
                            spacing={0.5}
                            sx={{ alignItems: 'center', justifyContent: 'space-between' }}
                          >
                            <Typography variant="h3">Übung {uebungNummer}</Typography>
                            <Stack direction="row" spacing={0.25}>
                              <IconButton
                                type="button"
                                aria-label={`Übung ${uebungNummer} nach oben verschieben`}
                                disabled={uIndex === 0}
                                onClick={() => uebungVerschieben(uIndex, -1)}
                                sx={{ minWidth: 48, minHeight: 48 }}
                              >
                                <ArrowUpwardOutlinedIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                type="button"
                                aria-label={`Übung ${uebungNummer} nach unten verschieben`}
                                disabled={uIndex === formular.uebungen.length - 1}
                                onClick={() => uebungVerschieben(uIndex, 1)}
                                sx={{ minWidth: 48, minHeight: 48 }}
                              >
                                <ArrowDownwardOutlinedIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                type="button"
                                color="error"
                                aria-label={`Übung ${uebungNummer} entfernen`}
                                onClick={() => uebungEntfernen(uebung.clientId)}
                                sx={{ minWidth: 48, minHeight: 48 }}
                              >
                                <DeleteOutlineOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Stack>
                          </Stack>

                          <Box
                            sx={{
                              display: 'grid',
                              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                              gap: 2,
                            }}
                          >
                            <TextField
                              id={`${idPraefix}-uebung-${uebung.clientId}-name`}
                              label="Übungsname"
                              required
                              fullWidth
                              value={uebung.name}
                              onChange={(e) =>
                                aktualisiereUebung(uebung.clientId, { name: e.target.value })
                              }
                              error={Boolean(uebungFehler?.name)}
                              helperText={uebungFehler?.name}
                              slotProps={{ htmlInput: { maxLength: UEBUNG_NAME_MAX_LAENGE } }}
                            />
                            <TextField
                              id={`${idPraefix}-uebung-${uebung.clientId}-variante`}
                              label="Variante (optional)"
                              placeholder="z. B. Tuck, Adv. Tuck, High Bar"
                              fullWidth
                              value={uebung.variante}
                              onChange={(e) =>
                                aktualisiereUebung(uebung.clientId, { variante: e.target.value })
                              }
                              error={Boolean(uebungFehler?.variante)}
                              helperText={uebungFehler?.variante}
                              slotProps={{ htmlInput: { maxLength: UEBUNG_VARIANTE_MAX_LAENGE } }}
                            />
                          </Box>

                          <Divider />

                          <Stack spacing={1.5}>
                            <Stack
                              direction="row"
                              sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}
                            >
                              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                Sätze ({uebung.saetze.length})
                              </Typography>
                              <Button
                                type="button"
                                size="small"
                                variant="text"
                                startIcon={<AddOutlinedIcon />}
                                onClick={() => satzHinzufuegen(uebung.clientId)}
                                sx={{ minHeight: 44 }}
                              >
                                Satz hinzufügen
                              </Button>
                            </Stack>

                            {uebung.saetze.map((satz, sIndex) => {
                              const satzFehler = uebungFehler?.saetze[satz.clientId];
                              const satzNummer = sIndex + 1;
                              const satzDauerVorschau = formatiereDauerVorschau(
                                satz.dauerSekunden,
                                1,
                              );
                              const satzPauseVorschau = formatiereDauerVorschau(
                                satz.pauseSekunden,
                                0,
                              );

                              return (
                                <Paper
                                  key={satz.clientId}
                                  variant="outlined"
                                  sx={{
                                    p: { xs: 1.5, sm: 2 },
                                    borderRadius: 2.5,
                                    bgcolor: 'background.default',
                                  }}
                                >
                                  <Stack spacing={1.5}>
                                    <Stack
                                      direction="row"
                                      sx={{ alignItems: 'center', justifyContent: 'space-between' }}
                                    >
                                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                        Satz {satzNummer}
                                      </Typography>
                                      <Stack direction="row" spacing={0.25}>
                                        <IconButton
                                          type="button"
                                          size="small"
                                          aria-label={`Übung ${uebungNummer}, Satz ${satzNummer} nach oben verschieben`}
                                          disabled={sIndex === 0}
                                          onClick={() => satzVerschieben(uebung.clientId, sIndex, -1)}
                                          sx={{ minWidth: 48, minHeight: 48 }}
                                        >
                                          <ArrowUpwardOutlinedIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton
                                          type="button"
                                          size="small"
                                          aria-label={`Übung ${uebungNummer}, Satz ${satzNummer} nach unten verschieben`}
                                          disabled={sIndex === uebung.saetze.length - 1}
                                          onClick={() => satzVerschieben(uebung.clientId, sIndex, 1)}
                                          sx={{ minWidth: 48, minHeight: 48 }}
                                        >
                                          <ArrowDownwardOutlinedIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton
                                          type="button"
                                          size="small"
                                          color="error"
                                          aria-label={`Übung ${uebungNummer}, Satz ${satzNummer} entfernen`}
                                          onClick={() => satzEntfernen(uebung.clientId, satz.clientId)}
                                          sx={{ minWidth: 48, minHeight: 48 }}
                                        >
                                          <DeleteOutlineOutlinedIcon fontSize="small" />
                                        </IconButton>
                                      </Stack>
                                    </Stack>

                                    <Box
                                      sx={{
                                        display: 'grid',
                                        gridTemplateColumns: {
                                          xs: 'repeat(2, minmax(0, 1fr))',
                                          sm: 'repeat(4, minmax(0, 1fr))',
                                        },
                                        gap: 1.5,
                                      }}
                                    >
                                      <TextField
                                        id={`${idPraefix}-satz-${satz.clientId}-wdh`}
                                        label="Wiederholungen"
                                        size="small"
                                        fullWidth
                                        value={satz.wiederholungen}
                                        onChange={(e) =>
                                          aktualisiereSatz(uebung.clientId, satz.clientId, {
                                            wiederholungen: e.target.value,
                                          })
                                        }
                                        error={Boolean(
                                          satzFehler?.wiederholungen || satzFehler?.allgemein,
                                        )}
                                        helperText={satzFehler?.wiederholungen}
                                        slotProps={{ htmlInput: { inputMode: 'numeric' } }}
                                      />

                                      <TextField
                                        id={`${idPraefix}-satz-${satz.clientId}-dauer`}
                                        label="Dauer (Sek.)"
                                        size="small"
                                        fullWidth
                                        value={satz.dauerSekunden}
                                        onChange={(e) =>
                                          aktualisiereSatz(uebung.clientId, satz.clientId, {
                                            dauerSekunden: e.target.value,
                                          })
                                        }
                                        error={Boolean(
                                          satzFehler?.dauerSekunden || satzFehler?.allgemein,
                                        )}
                                        helperText={
                                          satzFehler?.dauerSekunden ? (
                                            satzFehler.dauerSekunden
                                          ) : satzDauerVorschau ? (
                                            <Box
                                              component="span"
                                              aria-label={satzDauerVorschau.ariaLabel}
                                            >
                                              {satzDauerVorschau.text}
                                            </Box>
                                          ) : undefined
                                        }
                                        slotProps={{ htmlInput: { inputMode: 'numeric' } }}
                                      />

                                      <TextField
                                        id={`${idPraefix}-satz-${satz.clientId}-gewicht`}
                                        label="Gewicht (kg)"
                                        size="small"
                                        fullWidth
                                        value={satz.gewichtKg}
                                        onChange={(e) =>
                                          aktualisiereSatz(uebung.clientId, satz.clientId, {
                                            gewichtKg: e.target.value,
                                          })
                                        }
                                        error={Boolean(satzFehler?.gewichtKg)}
                                        helperText={satzFehler?.gewichtKg}
                                        slotProps={{ htmlInput: { inputMode: 'decimal' } }}
                                      />

                                      <TextField
                                        id={`${idPraefix}-satz-${satz.clientId}-pause`}
                                        label="Pause (Sek.)"
                                        size="small"
                                        fullWidth
                                        value={satz.pauseSekunden}
                                        onChange={(e) =>
                                          aktualisiereSatz(uebung.clientId, satz.clientId, {
                                            pauseSekunden: e.target.value,
                                          })
                                        }
                                        error={Boolean(satzFehler?.pauseSekunden)}
                                        helperText={
                                          satzFehler?.pauseSekunden ? (
                                            satzFehler.pauseSekunden
                                          ) : satzPauseVorschau ? (
                                            <Box
                                              component="span"
                                              aria-label={satzPauseVorschau.ariaLabel}
                                            >
                                              {satzPauseVorschau.text}
                                            </Box>
                                          ) : undefined
                                        }
                                        slotProps={{ htmlInput: { inputMode: 'numeric' } }}
                                      />
                                    </Box>

                                    {satzFehler?.allgemein ? (
                                      <FormHelperText error sx={{ mx: 0 }}>
                                        {satzFehler.allgemein}
                                      </FormHelperText>
                                    ) : null}
                                  </Stack>
                                </Paper>
                              );
                            })}
                          </Stack>
                        </Stack>
                      </Paper>
                    );
                  })}
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>

        <Stack
          direction={{ xs: 'column-reverse', sm: 'row' }}
          spacing={1.5}
          sx={{ justifyContent: 'flex-end' }}
        >
          {onAbbrechen ? (
            <Button
              type="button"
              variant="outlined"
              size="large"
              disabled={speichert}
              onClick={onAbbrechen}
              sx={{ minHeight: 48 }}
            >
              Abbrechen
            </Button>
          ) : abbrechenZiel ? (
            <Button
              component={RouterLink}
              to={abbrechenZiel}
              variant="outlined"
              size="large"
              sx={{ minHeight: 48 }}
            >
              Abbrechen
            </Button>
          ) : null}

          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={speichert}
            sx={{ minHeight: 48 }}
          >
            {speichert ? 'Speichert …' : absendenLabel}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
