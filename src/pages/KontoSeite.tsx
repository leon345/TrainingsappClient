import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined';
import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import PersonAddAlt1OutlinedIcon from '@mui/icons-material/PersonAddAlt1Outlined';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link as RouterLink } from 'react-router';
import { extrahiereFehlermeldung, type PasskeyV1 } from '../api/client';
import { formatiereDatum } from '../format/datum';
import { useAuth } from '../konto/AuthContext';
import {
  normalisiereBenutzername,
  PASSKEY_BEZEICHNUNG_MAX_LAENGE,
  pruefeBenutzername,
  pruefePasskeyBezeichnung,
} from '../konto/benutzername';
import {
  erstellePasskeyCredential,
  istWebAuthnUnterstuetzt,
  pruefePasskeyCredential,
} from '../konto/webauthn';

export function KontoSeite() {
  const {
    benutzer,
    status,
    fehlerMeldung: authFehler,
    frischRegistriert,
    apiClient,
    aktualisiereSitzung,
    setzeAngemeldetenBenutzer,
    abmelden,
  } = useAuth();

  const webAuthnUnterstuetzt = istWebAuthnUnterstuetzt();

  // Formularzustand: Registrierung
  const [registrierenName, setRegistrierenName] = useState('');
  const [registrierenBeruehrt, setRegistrierenBeruehrt] = useState(false);
  const [einwilligungErteilt, setEinwilligungErteilt] = useState(false);
  const [einwilligungFehler, setEinwilligungFehler] = useState<string | null>(null);

  // Formularzustand: Anmeldung (optionaler Benutzername)
  const [anmeldenName, setAnmeldenName] = useState('');
  const [anmeldenNameFehler, setAnmeldenNameFehler] = useState<string | null>(null);

  // Rückmeldungen & Ladezustand für Auth-/Passkey-Aktionen
  const [aktionLaeuft, setAktionLaeuft] = useState(false);
  const [fehlerText, setFehlerText] = useState<string | null>(null);
  const [erfolgText, setErfolgText] = useState<string | null>(null);

  // Passkey-Verwaltung
  const [passkeys, setPasskeys] = useState<PasskeyV1[]>([]);
  const [passkeysLadend, setPasskeysLadend] = useState(false);
  const [passkeysGeladen, setPasskeysGeladen] = useState(false);
  const [passkeyLadeFehler, setPasskeyLadeFehler] = useState<string | null>(null);

  // Dialoge: Umbenennen & Löschen
  const [umbenennenZiel, setUmbenennenZiel] = useState<PasskeyV1 | null>(null);
  const [umbenennenEingabe, setUmbenennenEingabe] = useState('');
  const [umbenennenFehler, setUmbenennenFehler] = useState<string | null>(null);
  const [loeschenZiel, setLoeschenZiel] = useState<PasskeyV1 | null>(null);

  const ladePasskeys = useCallback(async () => {
    setPasskeysLadend(true);
    setPasskeyLadeFehler(null);
    try {
      const { data, error, response } = await apiClient.GET('/v1/passkeys');
      if (response.ok && Array.isArray(data)) {
        setPasskeys(data);
        setPasskeysGeladen(true);
        return;
      }
      setPasskeyLadeFehler(
        extrahiereFehlermeldung(error, 'Passkeys konnten nicht geladen werden.', response),
      );
      setPasskeysGeladen(false);
    } catch (ex) {
      setPasskeyLadeFehler(
        extrahiereFehlermeldung(ex, 'Passkeys konnten wegen eines Netzwerkfehlers nicht geladen werden.'),
      );
      setPasskeysGeladen(false);
    } finally {
      setPasskeysLadend(false);
    }
  }, [apiClient]);

  useEffect(() => {
    if (status !== 'angemeldet' || !benutzer) {
      return;
    }

    let aktiv = true;
    const initialLaden = async () => {
      setPasskeysLadend(true);
      setPasskeyLadeFehler(null);
      try {
        const { data, error, response } = await apiClient.GET('/v1/passkeys');
        if (!aktiv) {
          return;
        }
        if (response.ok && Array.isArray(data)) {
          setPasskeys(data);
          setPasskeysGeladen(true);
        } else {
          setPasskeyLadeFehler(
            extrahiereFehlermeldung(error, 'Passkeys konnten nicht geladen werden.', response),
          );
          setPasskeysGeladen(false);
        }
      } catch (ex) {
        if (!aktiv) {
          return;
        }
        setPasskeyLadeFehler(
          extrahiereFehlermeldung(
            ex,
            'Passkeys konnten wegen eines Netzwerkfehlers nicht geladen werden.',
          ),
        );
        setPasskeysGeladen(false);
      } finally {
        if (aktiv) {
          setPasskeysLadend(false);
        }
      }
    };

    void initialLaden();
    return () => {
      aktiv = false;
    };
  }, [status, benutzer, apiClient]);

  const benutzernamePruefung = pruefeBenutzername(registrierenName);
  const zeigeBenutzernameFehler =
    (registrierenBeruehrt || registrierenName.length > 0) && !benutzernamePruefung.gueltig;

  const handleRegistrieren = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRegistrierenBeruehrt(true);
    setFehlerText(null);
    setErfolgText(null);

    const pruefung = pruefeBenutzername(registrierenName);
    let hatFehler = false;

    if (!pruefung.gueltig) {
      hatFehler = true;
    }
    if (!einwilligungErteilt) {
      setEinwilligungFehler('Bitte erteile deine ausdrückliche Einwilligung in die Datenverarbeitung.');
      hatFehler = true;
    } else {
      setEinwilligungFehler(null);
    }

    if (hatFehler || !webAuthnUnterstuetzt) {
      return;
    }

    setAktionLaeuft(true);
    try {
      const optionenAntwort = await apiClient.POST('/v1/registrieren/optionen', {
        body: {
          benutzername: pruefung.normalisiert,
          einwilligungErteilt: true,
        },
      });

      if (!optionenAntwort.response.ok || !optionenAntwort.data) {
        setFehlerText(
          extrahiereFehlermeldung(
            optionenAntwort.error,
            'Registrierung konnte nicht gestartet werden.',
            optionenAntwort.response,
          ),
        );
        return;
      }

      const credential = await erstellePasskeyCredential(optionenAntwort.data.optionen);

      const abschlussAntwort = await apiClient.POST('/v1/registrieren', {
        body: {
          benutzername: pruefung.normalisiert,
          credential,
        },
      });

      if (!abschlussAntwort.response.ok || !abschlussAntwort.data) {
        setFehlerText(
          extrahiereFehlermeldung(
            abschlussAntwort.error,
            'Registrierung konnte nicht abgeschlossen werden.',
            abschlussAntwort.response,
          ),
        );
        return;
      }

      setRegistrierenName('');
      setRegistrierenBeruehrt(false);
      setEinwilligungErteilt(false);
      setEinwilligungFehler(null);
      setPasskeys([]);
      setPasskeysGeladen(false);
      setzeAngemeldetenBenutzer(abschlussAntwort.data, true);
    } catch (ex) {
      setFehlerText(extrahiereFehlermeldung(ex, 'Registrierung fehlgeschlagen.'));
    } finally {
      setAktionLaeuft(false);
    }
  };

  const fuehreAnmeldungAus = async (optionalerBenutzername?: string) => {
    if (!webAuthnUnterstuetzt) {
      return;
    }
    setFehlerText(null);
    setErfolgText(null);
    setAnmeldenNameFehler(null);
    setAktionLaeuft(true);

    try {
      const body = optionalerBenutzername
        ? { benutzername: normalisiereBenutzername(optionalerBenutzername) }
        : {};
      const optionenAntwort = await apiClient.POST('/v1/anmelden/optionen', { body });

      if (!optionenAntwort.response.ok || !optionenAntwort.data) {
        setFehlerText(
          extrahiereFehlermeldung(
            optionenAntwort.error,
            'Anmeldung konnte nicht gestartet werden.',
            optionenAntwort.response,
          ),
        );
        return;
      }

      const credential = await pruefePasskeyCredential(optionenAntwort.data.optionen);

      const anmeldenAntwort = await apiClient.POST('/v1/anmelden', {
        body: { credential },
      });

      if (!anmeldenAntwort.response.ok || !anmeldenAntwort.data) {
        setFehlerText(
          extrahiereFehlermeldung(
            anmeldenAntwort.error,
            'Anmeldung fehlgeschlagen.',
            anmeldenAntwort.response,
          ),
        );
        return;
      }

      setAnmeldenName('');
      setPasskeys([]);
      setPasskeysGeladen(false);
      setzeAngemeldetenBenutzer(anmeldenAntwort.data, false);
    } catch (ex) {
      setFehlerText(extrahiereFehlermeldung(ex, 'Anmeldung fehlgeschlagen.'));
    } finally {
      setAktionLaeuft(false);
    }
  };

  const handleAnmeldenMitName = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const bereinigt = anmeldenName.trim();
    if (bereinigt.length === 0) {
      setAnmeldenNameFehler('Bitte gib deinen Benutzernamen ein oder nutze „Mit Passkey anmelden“.');
      return;
    }
    await fuehreAnmeldungAus(bereinigt);
  };

  const handleAbmelden = async () => {
    setFehlerText(null);
    setErfolgText(null);
    setAktionLaeuft(true);
    try {
      const ergebnis = await abmelden();
      if (ergebnis.erfolg) {
        setPasskeys([]);
        setPasskeysGeladen(false);
        setErfolgText('Du wurdest erfolgreich abgemeldet.');
      } else if (ergebnis.fehler) {
        setFehlerText(ergebnis.fehler);
      }
    } finally {
      setAktionLaeuft(false);
    }
  };

  const handlePasskeyHinzufuegen = async () => {
    if (!webAuthnUnterstuetzt) {
      return;
    }
    setFehlerText(null);
    setErfolgText(null);
    setAktionLaeuft(true);

    try {
      const optionenAntwort = await apiClient.POST('/v1/passkeys/optionen');
      if (!optionenAntwort.response.ok || !optionenAntwort.data) {
        setFehlerText(
          extrahiereFehlermeldung(
            optionenAntwort.error,
            'Neuer Passkey konnte nicht vorbereitet werden.',
            optionenAntwort.response,
          ),
        );
        return;
      }

      const credential = await erstellePasskeyCredential(optionenAntwort.data.optionen);

      const speichernAntwort = await apiClient.POST('/v1/passkeys', {
        body: { credential },
      });

      if (!speichernAntwort.response.ok || !speichernAntwort.data) {
        setFehlerText(
          extrahiereFehlermeldung(
            speichernAntwort.error,
            'Neuer Passkey konnte nicht gespeichert werden.',
            speichernAntwort.response,
          ),
        );
        return;
      }

      setErfolgText(`Passkey „${speichernAntwort.data.bezeichnung}“ wurde hinzugefügt.`);
      await ladePasskeys();
    } catch (ex) {
      setFehlerText(extrahiereFehlermeldung(ex, 'Passkey konnte nicht hinzugefügt werden.'));
    } finally {
      setAktionLaeuft(false);
    }
  };

  const oeffneUmbenennenDialog = (passkey: PasskeyV1) => {
    setUmbenennenZiel(passkey);
    setUmbenennenEingabe(passkey.bezeichnung);
    setUmbenennenFehler(null);
  };

  const handleUmbenennenSpeichern = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!umbenennenZiel) {
      return;
    }
    const pruefung = pruefePasskeyBezeichnung(umbenennenEingabe);
    if (!pruefung.gueltig) {
      setUmbenennenFehler(pruefung.fehler);
      return;
    }

    setAktionLaeuft(true);
    setUmbenennenFehler(null);
    setFehlerText(null);
    setErfolgText(null);

    try {
      const { data, error, response } = await apiClient.PATCH('/v1/passkeys/{id}', {
        params: { path: { id: umbenennenZiel.id } },
        body: { bezeichnung: pruefung.bereinigt },
      });

      if (!response.ok || !data) {
        setUmbenennenFehler(
          extrahiereFehlermeldung(error, 'Passkey konnte nicht umbenannt werden.', response),
        );
        return;
      }

      setPasskeys((aktuell) => aktuell.map((p) => (p.id === data.id ? data : p)));
      setUmbenennenZiel(null);
      setErfolgText(`Passkey wurde in „${data.bezeichnung}“ umbenannt.`);
    } catch (ex) {
      setUmbenennenFehler(
        extrahiereFehlermeldung(ex, 'Passkey konnte wegen eines Netzwerkfehlers nicht umbenannt werden.'),
      );
    } finally {
      setAktionLaeuft(false);
    }
  };

  const handlePasskeyLoeschen = async () => {
    if (!loeschenZiel) {
      return;
    }

    const ziel = loeschenZiel;
    setAktionLaeuft(true);
    setFehlerText(null);
    setErfolgText(null);

    try {
      const { error, response } = await apiClient.DELETE('/v1/passkeys/{id}', {
        params: { path: { id: ziel.id } },
      });

      if (response.status === 204 || response.ok) {
        setPasskeys((aktuell) => aktuell.filter((p) => p.id !== ziel.id));
        setLoeschenZiel(null);
        setErfolgText(`Passkey „${ziel.bezeichnung}“ wurde gelöscht.`);
        return;
      }

      setLoeschenZiel(null);
      setFehlerText(
        extrahiereFehlermeldung(error, 'Passkey konnte nicht gelöscht werden.', response),
      );
    } catch (ex) {
      setLoeschenZiel(null);
      setFehlerText(
        extrahiereFehlermeldung(ex, 'Passkey konnte wegen eines Netzwerkfehlers nicht gelöscht werden.'),
      );
    } finally {
      setAktionLaeuft(false);
    }
  };

  const istLetzterPasskey = passkeys.length <= 1;

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h1" gutterBottom>
          Konto
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Passwortlose Anmeldung per Passkey und Verwaltung deiner hinterlegten Schlüssel.
        </Typography>
      </Box>

      {!webAuthnUnterstuetzt ? (
        <Alert severity="warning">
          <AlertTitle>Passkeys werden in diesem Browser nicht unterstützt</AlertTitle>
          Dein Browser unterstützt die modernen WebAuthn-JSON-Schnittstellen nicht. Registrierung
          und Anmeldung per Passkey sind daher deaktiviert – der Intervalltimer bleibt lokal
          vollständig nutzbar.
        </Alert>
      ) : null}

      {status === 'fehler' && authFehler ? (
        <Alert
          severity="warning"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => void aktualisiereSitzung()}
              disabled={aktionLaeuft}
            >
              Erneut prüfen
            </Button>
          }
        >
          {authFehler}
        </Alert>
      ) : null}

      {fehlerText ? (
        <Alert severity="error" onClose={() => setFehlerText(null)}>
          {fehlerText}
        </Alert>
      ) : null}

      {erfolgText ? (
        <Alert severity="success" onClose={() => setErfolgText(null)}>
          {erfolgText}
        </Alert>
      ) : null}

      {status === 'ladend' ? (
        <Card>
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <CircularProgress size={24} aria-hidden="true" />
              <Typography variant="body1">Sitzungsstatus wird geprüft …</Typography>
            </Stack>
          </CardContent>
        </Card>
      ) : status === 'angemeldet' && benutzer ? (
        <>
          <Card>
            <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                sx={{ justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' } }}
              >
                <Stack spacing={1} sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <Chip
                      icon={<VerifiedUserOutlinedIcon />}
                      label="Angemeldet"
                      color="primary"
                      size="small"
                    />
                  </Stack>
                  <Typography variant="h2" sx={{ wordBreak: 'break-word' }}>
                    {benutzer.benutzername}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Konto erstellt am {formatiereDatum(benutzer.erstelltAm)}
                  </Typography>
                </Stack>

                <Button
                  variant="outlined"
                  startIcon={<LogoutRoundedIcon />}
                  onClick={() => void handleAbmelden()}
                  disabled={aktionLaeuft}
                >
                  Abmelden
                </Button>
              </Stack>
            </CardContent>
          </Card>

          {passkeysGeladen && passkeys.length === 1 ? (
            <Alert severity="warning" icon={<KeyOutlinedIcon />}>
              <AlertTitle>Zweiten Passkey als Ersatz hinterlegen</AlertTitle>
              <Stack spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                <Typography variant="body2">
                  {frischRegistriert
                    ? 'Dein Konto wurde erstellt! Bitte hinterlege jetzt einen zweiten Passkey (z. B. Smartphone oder Sicherheitsschlüssel), damit du bei Geräteverlust nicht ausgesperrt wirst.'
                    : 'In deinem Konto ist aktuell nur ein Passkey hinterlegt. Füge einen zweiten Passkey als Ersatz hinzu, um bei Geräteverlust Zugang zu behalten.'}
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AddRoundedIcon />}
                  onClick={() => void handlePasskeyHinzufuegen()}
                  disabled={!webAuthnUnterstuetzt || aktionLaeuft}
                >
                  Zweiten Passkey hinzufügen
                </Button>
              </Stack>
            </Alert>
          ) : null}

          <Card>
            <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
              <Stack spacing={2.5}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.5}
                  sx={{
                    justifyContent: 'space-between',
                    alignItems: { xs: 'flex-start', sm: 'center' },
                  }}
                >
                  <Box>
                    <Typography variant="h3" component="h2">
                      Deine Passkeys
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Verwalte alle hinterlegten Schlüssel für dein Konto.
                    </Typography>
                  </Box>

                  <Button
                    variant="outlined"
                    startIcon={<AddRoundedIcon />}
                    onClick={() => void handlePasskeyHinzufuegen()}
                    disabled={!webAuthnUnterstuetzt || aktionLaeuft}
                  >
                    Weiteren Passkey hinzufügen
                  </Button>
                </Stack>

                {passkeyLadeFehler ? (
                  <Alert
                    severity="error"
                    action={
                      <Button color="inherit" size="small" onClick={() => void ladePasskeys()}>
                        Erneut laden
                      </Button>
                    }
                  >
                    {passkeyLadeFehler}
                  </Alert>
                ) : null}

                {passkeysLadend && !passkeysGeladen ? (
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', py: 1 }}>
                    <CircularProgress size={20} aria-hidden="true" />
                    <Typography variant="body2" color="text.secondary">
                      Passkeys werden geladen …
                    </Typography>
                  </Stack>
                ) : null}

                {passkeysGeladen ? (
                  <>
                    <List disablePadding aria-label="Hinterlegte Passkeys">
                      {passkeys.map((passkey, index) => (
                        <ListItem
                          key={passkey.id}
                          disableGutters
                          divider={index < passkeys.length - 1}
                          sx={{ py: 1.5 }}
                        >
                          <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1.5}
                            sx={{
                              width: '100%',
                              justifyContent: 'space-between',
                              alignItems: { xs: 'flex-start', sm: 'center' },
                            }}
                          >
                            <Box sx={{ minWidth: 0 }}>
                              <Typography
                                variant="subtitle1"
                                sx={{ fontWeight: 600, wordBreak: 'break-word' }}
                              >
                                {passkey.bezeichnung}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Erstellt am {formatiereDatum(passkey.erstelltAm)} · Zuletzt
                                verwendet:{' '}
                                {passkey.zuletztVerwendetAm
                                  ? formatiereDatum(passkey.zuletztVerwendetAm)
                                  : 'Noch nie verwendet'}
                              </Typography>
                            </Box>

                            <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
                              <Tooltip title="Passkey umbenennen">
                                <span>
                                  <IconButton
                                    aria-label={`Passkey ${passkey.bezeichnung} umbenennen`}
                                    onClick={() => oeffneUmbenennenDialog(passkey)}
                                    disabled={aktionLaeuft}
                                  >
                                    <EditOutlinedIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>

                              <Tooltip
                                title={
                                  istLetzterPasskey
                                    ? 'Letzter Passkey kann nicht gelöscht werden'
                                    : 'Passkey löschen'
                                }
                              >
                                <span>
                                  <IconButton
                                    aria-label={`Passkey ${passkey.bezeichnung} löschen`}
                                    color="error"
                                    onClick={() => setLoeschenZiel(passkey)}
                                    disabled={istLetzterPasskey || aktionLaeuft}
                                  >
                                    <DeleteOutlineOutlinedIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </Stack>
                          </Stack>
                        </ListItem>
                      ))}
                    </List>

                    {istLetzterPasskey ? (
                      <Typography variant="caption" color="text.secondary">
                        Letzter Passkey kann nicht gelöscht werden. Hinterlege zuerst einen zweiten
                        Passkey, um diesen entfernen zu können.
                      </Typography>
                    ) : null}
                  </>
                ) : null}
              </Stack>
            </CardContent>
          </Card>

          <Dialog
            open={umbenennenZiel !== null}
            onClose={() => {
              if (!aktionLaeuft) {
                setUmbenennenZiel(null);
              }
            }}
            fullWidth
            maxWidth="xs"
          >
            <Box component="form" noValidate onSubmit={(e) => void handleUmbenennenSpeichern(e)}>
              <DialogTitle>Passkey umbenennen</DialogTitle>
              <DialogContent>
                <DialogContentText sx={{ mb: 2 }}>
                  Vergib eine eindeutige Bezeichnung (1–{PASSKEY_BEZEICHNUNG_MAX_LAENGE} Zeichen),
                  z. B. „Smartphone“ oder „YubiKey Arbeit“.
                </DialogContentText>
                <TextField
                  autoFocus
                  fullWidth
                  margin="dense"
                  id="passkey-bezeichnung"
                  label="Bezeichnung"
                  value={umbenennenEingabe}
                  onChange={(e) => {
                    setUmbenennenEingabe(e.target.value);
                    const pruefung = pruefePasskeyBezeichnung(e.target.value);
                    setUmbenennenFehler(pruefung.gueltig ? null : pruefung.fehler);
                  }}
                  error={umbenennenFehler !== null}
                  helperText={
                    umbenennenFehler ??
                    `${umbenennenEingabe.trim().length}/${PASSKEY_BEZEICHNUNG_MAX_LAENGE} Zeichen`
                  }
                  slotProps={{
                    htmlInput: {
                      maxLength: PASSKEY_BEZEICHNUNG_MAX_LAENGE,
                    },
                  }}
                />
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setUmbenennenZiel(null)} disabled={aktionLaeuft}>
                  Abbrechen
                </Button>
                <Button type="submit" variant="contained" disabled={aktionLaeuft}>
                  Speichern
                </Button>
              </DialogActions>
            </Box>
          </Dialog>

          <Dialog
            open={loeschenZiel !== null}
            onClose={() => {
              if (!aktionLaeuft) {
                setLoeschenZiel(null);
              }
            }}
            fullWidth
            maxWidth="xs"
          >
            <DialogTitle>Passkey löschen?</DialogTitle>
            <DialogContent>
              <DialogContentText>
                Möchtest du den Passkey „{loeschenZiel?.bezeichnung}“ wirklich löschen? Eine
                Anmeldung mit diesem Schlüssel ist danach nicht mehr möglich.
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setLoeschenZiel(null)} disabled={aktionLaeuft}>
                Abbrechen
              </Button>
              <Button
                variant="contained"
                color="error"
                onClick={() => void handlePasskeyLoeschen()}
                disabled={aktionLaeuft}
              >
                Löschen
              </Button>
            </DialogActions>
          </Dialog>
        </>
      ) : (
        <Stack spacing={3}>
          <Card>
            <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
              <Stack spacing={2.5}>
                <Stack spacing={0.5}>
                  <Typography variant="h3" component="h2">
                    Anmelden
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Melde dich direkt mit einem auf diesem Gerät gespeicherten Passkey an – ganz
                    ohne Passwort.
                  </Typography>
                </Stack>

                <Box>
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<LoginRoundedIcon />}
                    onClick={() => void fuehreAnmeldungAus()}
                    disabled={!webAuthnUnterstuetzt || aktionLaeuft}
                  >
                    Mit Passkey anmelden
                  </Button>
                </Box>

                <Divider>oder mit Benutzernamen</Divider>

                <Box
                  component="form"
                  noValidate
                  onSubmit={(e) => void handleAnmeldenMitName(e)}
                >
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'flex-start' } }}>
                    <TextField
                      id="anmelden-benutzername"
                      label="Benutzername (optional)"
                      fullWidth
                      autoComplete="username webauthn"
                      value={anmeldenName}
                      onChange={(e) => {
                        setAnmeldenName(e.target.value);
                        if (anmeldenNameFehler) {
                          setAnmeldenNameFehler(null);
                        }
                      }}
                      error={anmeldenNameFehler !== null}
                      helperText={
                        anmeldenNameFehler ??
                        'Nur nötig, falls dein Gerät keine automatische Passkey-Auswahl anbietet.'
                      }
                      disabled={!webAuthnUnterstuetzt || aktionLaeuft}
                    />
                    <Button
                      type="submit"
                      variant="outlined"
                      size="large"
                      disabled={!webAuthnUnterstuetzt || aktionLaeuft}
                      sx={{ whiteSpace: 'nowrap', minHeight: 56 }}
                    >
                      Mit Benutzername anmelden
                    </Button>
                  </Stack>
                </Box>
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
              <Box component="form" noValidate onSubmit={(e) => void handleRegistrieren(e)}>
                <Stack spacing={2.5}>
                  <Stack spacing={0.5}>
                    <Typography variant="h3" component="h2">
                      Neues Konto registrieren
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Offene Registrierung ohne Einladungscode. Lege dein Konto direkt mit einem
                      Passkey an.
                    </Typography>
                  </Stack>

                  <Alert severity="info">
                    Proof of Concept (vollständig KI-generiert, keine Gewähr für Sicherheit oder
                    Verfügbarkeit). Bitte wähle ein Pseudonym – keine E-Mail-Adresse und keinen
                    Klarnamen.
                  </Alert>

                  <TextField
                    id="registrieren-benutzername"
                    label="Benutzername"
                    required
                    fullWidth
                    autoComplete="username"
                    value={registrierenName}
                    onChange={(e) => {
                      setRegistrierenName(e.target.value);
                    }}
                    onBlur={() => setRegistrierenBeruehrt(true)}
                    error={zeigeBenutzernameFehler}
                    helperText={
                      zeigeBenutzernameFehler
                        ? benutzernamePruefung.fehler
                        : 'Pseudonym wählen – keine E-Mail, kein Klarname (3–32 Zeichen: a–z, 0–9, ., _, -). Wird kleingeschrieben gespeichert.'
                    }
                    disabled={!webAuthnUnterstuetzt || aktionLaeuft}
                  />

                  <Box>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={einwilligungErteilt}
                          onChange={(_, gecheckt) => {
                            setEinwilligungErteilt(gecheckt);
                            if (gecheckt) {
                              setEinwilligungFehler(null);
                            }
                          }}
                          disabled={!webAuthnUnterstuetzt || aktionLaeuft}
                        />
                      }
                      label="Ich willige ausdrücklich in die Verarbeitung meiner Trainings- und Kontodaten gemäß den Datenschutzhinweisen ein."
                    />
                    <Box sx={{ pl: 4 }}>
                      <Link
                        component={RouterLink}
                        to="/datenschutz"
                        variant="body2"
                        underline="hover"
                        sx={{ fontWeight: 600 }}
                      >
                        Datenschutzhinweise lesen
                      </Link>
                      {einwilligungFehler ? (
                        <FormHelperText error>{einwilligungFehler}</FormHelperText>
                      ) : null}
                    </Box>
                  </Box>

                  <Box>
                    <Button
                      type="submit"
                      variant="contained"
                      size="large"
                      startIcon={<PersonAddAlt1OutlinedIcon />}
                      disabled={!webAuthnUnterstuetzt || aktionLaeuft}
                    >
                      Mit Passkey registrieren
                    </Button>
                  </Box>
                </Stack>
              </Box>
            </CardContent>
          </Card>
        </Stack>
      )}
    </Stack>
  );
}
