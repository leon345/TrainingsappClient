import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  PASSKEY_1,
  PASSKEY_2,
  browserFehler,
  fakeApi,
  fakePasskeyBrowser,
  httpFehler,
  netzFehler,
} from '../test/fakeKonto';
import { KontoAnsicht } from './KontoAnsicht';
import { erzeugeKontoSteuerung } from './steuerung';

/*
 * Konto-Ansicht (C-03) mit der echten Zustandslogik; API und WebAuthn sind
 * Attrappen (src/test/fakeKonto.ts).
 */

function aufbau(optionen: { angemeldet?: boolean; unterstuetzt?: boolean; offline?: boolean } = {}) {
  const api = fakeApi();
  if (!optionen.angemeldet) api.passkeys.mockRejectedValueOnce(httpFehler(401, 'NICHT_ANGEMELDET'));
  const pb = fakePasskeyBrowser(optionen.unterstuetzt ?? true);
  const steuerung = erzeugeKontoSteuerung({
    api,
    passkeys: pb,
    istOffline: () => optionen.offline ?? false,
    jetzt: () => 0,
  });
  const user = userEvent.setup();
  render(<KontoAnsicht steuerung={steuerung} />);
  return { api, pb, steuerung, user };
}

const status = () => screen.getByRole('status');
const alarm = () => screen.getByRole('alert');
const namensFeld = () => screen.getByRole('textbox', { name: 'Benutzername' });
const knopf = (name: string) => screen.getByRole('button', { name });

async function abgemeldet(optionen: { unterstuetzt?: boolean; offline?: boolean } = {}) {
  const a = aufbau(optionen);
  await screen.findByRole('heading', { level: 3, name: 'Registrieren' });
  return a;
}

async function angemeldet() {
  const a = aufbau({ angemeldet: true });
  await screen.findByRole('heading', { level: 3, name: 'Deine Passkeys' });
  return a;
}

describe('KontoAnsicht: nicht angemeldet', () => {
  it('prüft beim Öffnen per GET /v1/passkeys und sagt das Laden an', async () => {
    const { api } = aufbau();
    expect(status()).toHaveTextContent('Konto wird geladen');
    await screen.findByRole('heading', { level: 3, name: 'Registrieren' });
    expect(api.passkeys).toHaveBeenCalledTimes(1);
    expect(status()).toHaveTextContent('');
  });

  it('zeigt Registrieren mit Namensregel am Feld und Anmelden', async () => {
    await abgemeldet();
    expect(screen.getByRole('heading', { level: 2, name: 'Konto' })).toBeInTheDocument();
    expect(namensFeld()).toHaveAccessibleDescription(expect.stringMatching(/3 bis 32 Zeichen.*Keine E-Mail, kein Klarname/));
    expect(knopf('Registrieren')).toBeEnabled();
    expect(knopf('Mit Passkey anmelden')).toBeEnabled();
    expect(screen.queryByRole('heading', { name: 'Deine Passkeys' })).not.toBeInTheDocument();
    expect(alarm()).toBeEmptyDOMElement();
  });

  it('Registrieren per Tastatur (Enter): Liste, Hinweis auf zweiten Passkey, Ansage, Fokus auf Überschrift', async () => {
    const { api, user } = await abgemeldet();
    await user.type(namensFeld(), 'Anna{Enter}');
    await screen.findByRole('heading', { level: 3, name: 'Deine Passkeys' });
    expect(api.registrierungsOptionen).toHaveBeenCalledWith('anna');
    expect(screen.getByRole('heading', { level: 3, name: 'Lege einen zweiten Passkey an' })).toBeInTheDocument();
    expect(screen.getByText('Passkey 1')).toBeInTheDocument();
    await waitFor(() => expect(status()).toHaveTextContent('Registriert und angemeldet.'));
    expect(screen.getByRole('heading', { level: 2, name: 'Konto' })).toHaveFocus();
  });

  it('Anmelden: Liste mit einem Passkey und Hinweis (E3)', async () => {
    const { user, api } = await abgemeldet();
    await user.click(knopf('Mit Passkey anmelden'));
    await screen.findByRole('heading', { level: 3, name: 'Deine Passkeys' });
    expect(api.anmelden).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'Lege einen zweiten Passkey an' })).toBeInTheDocument();
    await waitFor(() => expect(status()).toHaveTextContent('Angemeldet.'));
    expect(screen.getByRole('heading', { level: 2, name: 'Konto' })).toHaveFocus();
  });

  it('während der Anmeldung: Ansage, der gedrückte Button bleibt fokussiert, die anderen sind gesperrt', async () => {
    const { user, pb } = await abgemeldet();
    let aufloesen!: (wert: unknown) => void;
    pb.abrufen.mockReturnValueOnce(new Promise((r) => (aufloesen = r)));
    await user.click(knopf('Mit Passkey anmelden'));
    expect(status()).toHaveTextContent('Anmeldung läuft');
    expect(knopf('Mit Passkey anmelden')).toHaveFocus();
    expect(knopf('Registrieren')).toBeDisabled();
    await act(async () => aufloesen({ id: 'x' }));
    await screen.findByRole('heading', { level: 3, name: 'Deine Passkeys' });
  });
});

describe('KontoAnsicht: angemeldet', () => {
  it('Liste: Bezeichnung, erstellt am, zuletzt verwendet bzw. noch nie', async () => {
    const steuerung = erzeugeKontoSteuerung({ api: fakeApi([PASSKEY_1, PASSKEY_2]), passkeys: fakePasskeyBrowser() });
    render(<KontoAnsicht steuerung={steuerung} />);
    const liste = await screen.findByRole('list');
    const eintraege = within(liste).getAllByRole('listitem');
    expect(eintraege).toHaveLength(2);
    expect(eintraege[0]).toHaveTextContent('Passkey 1');
    expect(eintraege[0]).toHaveTextContent('Erstellt am 01.11.2026');
    expect(eintraege[0]).toHaveTextContent('Zuletzt verwendet am 18.11.2026');
    expect(eintraege[1]).toHaveTextContent('Erstellt am 18.11.2026');
    expect(eintraege[1]).toHaveTextContent('Zuletzt verwendet: noch nie');
    expect(screen.queryByRole('heading', { name: 'Lege einen zweiten Passkey an' })).not.toBeInTheDocument();
  });

  it('Bezeichnung mit HTML-Zeichen erscheint als Text, nie als HTML (E29)', async () => {
    const api = fakeApi([
      { ...PASSKEY_1, bezeichnung: '<img src=x onerror="alert(1)"><b>Laptop</b> & Co' },
    ]);
    const steuerung = erzeugeKontoSteuerung({ api, passkeys: fakePasskeyBrowser() });
    const { container } = render(<KontoAnsicht steuerung={steuerung} />);
    const eintrag = await screen.findByRole('listitem');
    expect(eintrag).toHaveTextContent('<img src=x onerror="alert(1)"><b>Laptop</b> & Co');
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
  });

  it('Hinweis auf zweiten Passkey lässt sich ausblenden', async () => {
    const { user } = await angemeldet();
    await user.click(knopf('Hinweis ausblenden'));
    expect(screen.queryByRole('heading', { name: 'Lege einen zweiten Passkey an' })).not.toBeInTheDocument();
  });

  it('weiteren Passkey hinzufügen: neue Liste, Hinweis weg, Ansage, Fokus bleibt am Button', async () => {
    const { user, api } = await angemeldet();
    api.passkeys.mockResolvedValueOnce([PASSKEY_1, PASSKEY_2]);
    await user.click(knopf('Weiteren Passkey hinzufügen'));
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2));
    expect(api.passkeyHinzufuegen).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('heading', { name: 'Lege einen zweiten Passkey an' })).not.toBeInTheDocument();
    expect(status()).toHaveTextContent('Weiterer Passkey hinzugefügt.');
    expect(knopf('Weiteren Passkey hinzufügen')).toHaveFocus();
  });

  it('Abmelden: zurück zu Registrieren und Anmelden, Ansage, Fokus auf Überschrift', async () => {
    const { user, api } = await angemeldet();
    await user.click(knopf('Abmelden'));
    await screen.findByRole('heading', { level: 3, name: 'Registrieren' });
    expect(api.abmelden).toHaveBeenCalledTimes(1);
    expect(status()).toHaveTextContent('Abgemeldet.');
    expect(screen.getByRole('heading', { level: 2, name: 'Konto' })).toHaveFocus();
  });

  it('alles per Tastatur erreichbar: Tab führt über Hinweis, Hinzufügen und Abmelden', async () => {
    const { user } = await angemeldet();
    await user.tab();
    expect(knopf('Hinweis ausblenden')).toHaveFocus();
    await user.tab();
    expect(knopf('Weiteren Passkey hinzufügen')).toHaveFocus();
    await user.tab();
    expect(knopf('Abmelden')).toHaveFocus();
    await user.keyboard('{Enter}');
    await screen.findByRole('heading', { level: 3, name: 'Registrieren' });
  });
});

describe('KontoAnsicht: Fehler', () => {
  it('Name vergeben (409): Fehler am Feld, Fokus im Feld, Tippen löscht ihn', async () => {
    const { user, api } = await abgemeldet();
    api.registrierungsOptionen.mockRejectedValueOnce(httpFehler(409, 'BENUTZERNAME_VERGEBEN'));
    await user.type(namensFeld(), 'anna');
    await user.click(knopf('Registrieren'));
    await waitFor(() => expect(namensFeld()).toHaveAttribute('aria-invalid', 'true'));
    expect(namensFeld()).toHaveAccessibleDescription(expect.stringContaining('schon vergeben'));
    expect(namensFeld()).toHaveFocus();
    expect(alarm()).toBeEmptyDOMElement();
    await user.type(namensFeld(), 'x');
    expect(namensFeld()).not.toHaveAttribute('aria-invalid');
  });

  it('ungültiger Name (Client, E28): Fehler am Feld, kein Aufruf', async () => {
    const { user, api } = await abgemeldet();
    await user.type(namensFeld(), 'anna@example.org{Enter}');
    await waitFor(() => expect(namensFeld()).toHaveAttribute('aria-invalid', 'true'));
    expect(namensFeld()).toHaveAccessibleDescription(expect.stringContaining('keine Umlaute, Leerzeichen oder @'));
    expect(api.registrierungsOptionen).not.toHaveBeenCalled();
  });

  it('ungültiger Name vom Server (400): Fehler am Feld', async () => {
    const { user, api } = await abgemeldet();
    api.registrierungsOptionen.mockRejectedValueOnce(httpFehler(400, 'BENUTZERNAME_UNGUELTIG'));
    await user.type(namensFeld(), 'admin{Enter}');
    await waitFor(() =>
      expect(namensFeld()).toHaveAccessibleDescription(expect.stringContaining('nicht erlaubt')),
    );
  });

  it('Passkey-Abfrage abgebrochen: Meldung, bleibt abgemeldet', async () => {
    const { user, pb } = await abgemeldet();
    pb.abrufen.mockRejectedValueOnce(browserFehler('abgebrochen'));
    await user.click(knopf('Mit Passkey anmelden'));
    await waitFor(() => expect(alarm()).toHaveTextContent('Die Passkey-Abfrage wurde abgebrochen.'));
    expect(knopf('Mit Passkey anmelden')).toBeEnabled();
    expect(knopf('Mit Passkey anmelden')).toHaveFocus();
  });

  it('429: Meldung mit Wartezeit', async () => {
    const { user, api } = await abgemeldet();
    api.anmeldeOptionen.mockRejectedValueOnce(httpFehler(429, 'ZU_VIELE_ANFRAGEN', 90));
    await user.click(knopf('Mit Passkey anmelden'));
    await waitFor(() => expect(alarm()).toHaveTextContent('Zu viele Versuche. Bitte in 2 Minuten erneut versuchen.'));
  });

  it('offline: Meldung nennt den Timer', async () => {
    const { user, api } = await abgemeldet({ offline: true });
    api.anmeldeOptionen.mockRejectedValueOnce(netzFehler());
    await user.click(knopf('Mit Passkey anmelden'));
    await waitFor(() => expect(alarm()).toHaveTextContent(/Du bist offline.*Timer funktioniert auch ohne/));
  });

  it('Server beim Öffnen nicht erreichbar: Meldung und "Erneut versuchen"', async () => {
    const api = fakeApi();
    api.passkeys.mockRejectedValueOnce(httpFehler(502));
    const steuerung = erzeugeKontoSteuerung({ api, passkeys: fakePasskeyBrowser(), istOffline: () => false });
    const user = userEvent.setup();
    render(<KontoAnsicht steuerung={steuerung} />);
    await waitFor(() => expect(alarm()).toHaveTextContent('Der Server ist gerade nicht erreichbar.'));
    expect(screen.queryByRole('heading', { name: 'Registrieren' })).not.toBeInTheDocument();
    await user.click(knopf('Erneut versuchen'));
    await screen.findByRole('heading', { level: 3, name: 'Deine Passkeys' });
    expect(alarm()).toBeEmptyDOMElement();
  });

  it('Browser ohne WebAuthn: Hinweis, Registrieren und Anmelden gesperrt, kein Aufruf', async () => {
    const { api } = await abgemeldet({ unterstuetzt: false });
    expect(screen.getByText(/Dieser Browser unterstützt keine Passkeys/)).toBeInTheDocument();
    expect(knopf('Registrieren')).toBeDisabled();
    expect(knopf('Mit Passkey anmelden')).toBeDisabled();
    expect(api.registrierungsOptionen).not.toHaveBeenCalled();
  });

  it('derselbe Authenticator beim Hinzufügen: Meldung, Liste bleibt', async () => {
    const { user, pb } = await angemeldet();
    pb.erzeugen.mockRejectedValueOnce(browserFehler('schon-vorhanden'));
    await user.click(knopf('Weiteren Passkey hinzufügen'));
    await waitFor(() => expect(alarm()).toHaveTextContent('Auf diesem Gerät gibt es schon einen Passkey'));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('Sitzung abgelaufen (401) beim Hinzufügen: Meldung, zurück zur Anmeldung', async () => {
    const { user, api } = await angemeldet();
    api.passkeyOptionen.mockRejectedValueOnce(httpFehler(401, 'NICHT_ANGEMELDET'));
    await user.click(knopf('Weiteren Passkey hinzufügen'));
    await screen.findByRole('heading', { level: 3, name: 'Anmelden' });
    expect(alarm()).toHaveTextContent('Du bist nicht mehr angemeldet.');
    expect(screen.getByRole('heading', { level: 2, name: 'Konto' })).toHaveFocus();
  });

  it('Liste nach Registrierung nicht ladbar: angemeldet, Hinweis auf fehlende Liste und Meldung', async () => {
    const { user, api } = await abgemeldet();
    api.passkeys.mockRejectedValueOnce(netzFehler());
    await user.type(namensFeld(), 'anna{Enter}');
    await screen.findByText('Die Liste ist gerade nicht verfügbar.');
    expect(alarm()).toHaveTextContent('Der Server ist gerade nicht erreichbar.');
  });
});
