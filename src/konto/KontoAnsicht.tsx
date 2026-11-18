import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { Button, Card, Icon, TextField } from '../components/ui';
import { formatiereTag } from '../format/datum';
import type { Passkey } from './api';
import { BENUTZERNAME_REGEL } from './benutzername';
import { kontoFehlerText, type KontoAktion, type KontoFehler, type KontoSteuerung } from './steuerung';
import './KontoAnsicht.css';

/** Ansagen, solange eine Aktion läuft (Live-Region `role="status"`). */
const LADE_TEXT: Record<KontoAktion, string> = {
  pruefen: 'Konto wird geladen …',
  registrieren: 'Registrierung läuft. Bitte den Passkey im Browser bestätigen.',
  anmelden: 'Anmeldung läuft. Bitte einen Passkey im Browser auswählen.',
  hinzufuegen: 'Neuer Passkey wird angelegt. Bitte im Browser bestätigen.',
  abmelden: 'Abmeldung läuft …',
};

/** Ansagen nach Erfolg. */
const ERFOLG_TEXT: Partial<Record<KontoAktion, string>> = {
  registrieren: 'Registriert und angemeldet.',
  anmelden: 'Angemeldet.',
  hinzufuegen: 'Weiterer Passkey hinzugefügt.',
  abmelden: 'Abgemeldet.',
};

/** Fehler, die am Feld Benutzername stehen statt in der allgemeinen Meldung. */
function istNamensFehler(fehler: KontoFehler | null): boolean {
  return fehler?.art === 'name-ungueltig' || fehler?.art === 'name-vergeben';
}

export interface KontoAnsichtProps {
  steuerung: KontoSteuerung;
}

/**
 * Konto (C-03): Registrieren und Anmelden per Passkey; angemeldet die
 * Passkey-Liste, weiteren Passkey hinzufügen und Abmelden.
 *
 * Beim Öffnen wird per `GET /v1/passkeys` geprüft, ob jemand angemeldet ist.
 * Laufende Aktionen und Erfolge sagt eine Live-Region (`role="status"`) an,
 * Fehler eine eigene (`role="alert"`); Fehler zum Benutzernamen stehen am Feld.
 * Bezeichnungen der Passkeys kommen nur als Text in die Seite (E29).
 */
export function KontoAnsicht({ steuerung }: KontoAnsichtProps) {
  const zustand = useSyncExternalStore(steuerung.abonnieren, steuerung.holeZustand);
  const { status, laeuft, fehler, passkeys, webauthnUnterstuetzt } = zustand;
  const [name, setName] = useState('');
  const [erfolg, setErfolg] = useState('');
  const titel = useRef<HTMLHeadingElement>(null);
  const namensFeld = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void steuerung.pruefen();
  }, [steuerung]);

  // Wechsel zwischen angemeldet und abgemeldet: Der bisherige Inhalt (und
  // damit evtl. der Fokus) verschwindet, der Fokus geht auf die Überschrift.
  const vorher = useRef(status);
  useEffect(() => {
    const alt = vorher.current;
    vorher.current = status;
    if (alt !== 'unbekannt' && alt !== status) titel.current?.focus();
  }, [status]);

  // Fehler zum Namen: Fokus ins Feld, der Fehlertext hängt per aria-describedby daran.
  useEffect(() => {
    if (istNamensFehler(fehler)) namensFeld.current?.querySelector('input')?.focus();
  }, [fehler]);

  async function fuehreAus(aktion: KontoAktion, ablauf: () => Promise<boolean>) {
    setErfolg('');
    if (await ablauf()) setErfolg(ERFOLG_TEXT[aktion] ?? '');
  }

  const registrieren = (e: FormEvent) => {
    e.preventDefault();
    void fuehreAus('registrieren', () => steuerung.registrieren(name));
  };

  const beschaeftigt = laeuft !== null;
  /** Der Button der laufenden Aktion bleibt fokussierbar (pending), andere sind gesperrt. */
  const knopf = (aktion: KontoAktion, brauchtWebAuthn = false) =>
    laeuft === aktion ? { isPending: true } : { isDisabled: beschaeftigt || (brauchtWebAuthn && !webauthnUnterstuetzt) };

  const ansage = laeuft !== null ? LADE_TEXT[laeuft] : erfolg;
  const allgemeinerFehler = fehler !== null && !istNamensFehler(fehler) ? fehler : null;

  return (
    <section className="konto" aria-labelledby="konto-titel" data-status={status}>
      <h2 id="konto-titel" ref={titel} tabIndex={-1} className="konto__titel md-typescale-headline-small">
        Konto
      </h2>

      <p role="status" aria-live="polite" className="konto__status md-typescale-body-medium">
        {ansage}
      </p>

      <div role="alert" className="konto__fehler-region">
        {allgemeinerFehler && (
          <Card variant="outlined" className="konto__fehler">
            <p className="md-typescale-body-medium">{kontoFehlerText(allgemeinerFehler)}</p>
          </Card>
        )}
      </div>

      {!webauthnUnterstuetzt && (
        <Card variant="outlined" className="konto__hinweis">
          <p className="md-typescale-body-medium">
            Dieser Browser unterstützt keine Passkeys (oder nicht in der nötigen Version). Registrieren und
            Anmelden gehen hier nicht. Der Timer funktioniert auch ohne Konto.
          </p>
        </Card>
      )}

      {status === 'unbekannt' && laeuft === null && fehler !== null && (
        <Button variant="outlined" icon="restart_alt" onPress={() => void steuerung.pruefen()}>
          Erneut versuchen
        </Button>
      )}

      {status === 'abgemeldet' && (
        <div className="konto__karten">
          <Card elementType="section" variant="outlined" aria-labelledby="registrieren-titel">
            <h3 id="registrieren-titel" className="md-typescale-title-medium">
              Registrieren
            </h3>
            <form className="konto__formular" onSubmit={registrieren} noValidate>
              <div ref={namensFeld}>
                <TextField
                  label="Benutzername"
                  name="benutzername"
                  autoComplete="username"
                  spellCheck="false"
                  value={name}
                  onChange={(neu) => {
                    setName(neu);
                    if (istNamensFehler(fehler)) steuerung.fehlerSchliessen();
                  }}
                  description={BENUTZERNAME_REGEL}
                  isInvalid={istNamensFehler(fehler)}
                  errorMessage={fehler && istNamensFehler(fehler) ? kontoFehlerText(fehler) : undefined}
                />
              </div>
              <Button type="submit" icon="key" {...knopf('registrieren', true)}>
                Registrieren
              </Button>
            </form>
          </Card>

          <Card elementType="section" variant="outlined" aria-labelledby="anmelden-titel">
            <h3 id="anmelden-titel" className="md-typescale-title-medium">
              Anmelden
            </h3>
            <p className="md-typescale-body-medium">
              Mit einem gespeicherten Passkey, ohne Benutzernamen einzugeben.
            </p>
            <Button
              variant="tonal"
              icon="key"
              {...knopf('anmelden', true)}
              onPress={() => void fuehreAus('anmelden', steuerung.anmelden)}
            >
              Mit Passkey anmelden
            </Button>
          </Card>
        </div>
      )}

      {status === 'angemeldet' && (
        <div className="konto__karten">
          {zustand.zweitenPasskeyEmpfehlen && (
            <Card elementType="section" className="konto__empfehlung" aria-labelledby="empfehlung-titel">
              <h3 id="empfehlung-titel" className="md-typescale-title-medium">
                Lege einen zweiten Passkey an
              </h3>
              <p className="md-typescale-body-medium">
                Mit nur einem Passkey sperrst du dich aus, wenn das Gerät verloren geht oder der Passkey gelöscht
                wird. Ein zweiter Passkey, etwa auf einem anderen Gerät oder in einem anderen Passwortmanager,
                verhindert das.
              </p>
              <Button variant="text" icon="close" isDisabled={beschaeftigt} onPress={steuerung.hinweisSchliessen}>
                Hinweis ausblenden
              </Button>
            </Card>
          )}

          <Card elementType="section" variant="outlined" aria-labelledby="passkeys-titel">
            <h3 id="passkeys-titel" className="md-typescale-title-medium">
              Deine Passkeys
            </h3>
            {passkeys === null ? (
              <p className="md-typescale-body-medium">Die Liste ist gerade nicht verfügbar.</p>
            ) : (
              <ul className="konto__liste">
                {passkeys.map((p) => (
                  <PasskeyEintrag key={p.id} passkey={p} />
                ))}
              </ul>
            )}
            <div className="konto__aktionen">
              <Button
                icon="add"
                {...knopf('hinzufuegen', true)}
                onPress={() => void fuehreAus('hinzufuegen', steuerung.passkeyHinzufuegen)}
              >
                Weiteren Passkey hinzufügen
              </Button>
              <Button
                variant="outlined"
                {...knopf('abmelden')}
                onPress={() => void fuehreAus('abmelden', steuerung.abmelden)}
              >
                Abmelden
              </Button>
            </div>
          </Card>
        </div>
      )}
    </section>
  );
}

function PasskeyEintrag({ passkey }: { passkey: Passkey }) {
  return (
    <li className="konto__eintrag">
      <Icon name="key" />
      <div>
        {/* Nur als Text (E29): React setzt Strings als Textknoten, nie als HTML. */}
        <p className="konto__bezeichnung md-typescale-title-small">{passkey.bezeichnung}</p>
        <p className="konto__daten md-typescale-body-small">
          Erstellt am {formatiereTag(passkey.erstelltAm)}
          {' · '}
          {passkey.zuletztVerwendetAm === null
            ? 'Zuletzt verwendet: noch nie'
            : `Zuletzt verwendet am ${formatiereTag(passkey.zuletztVerwendetAm)}`}
        </p>
      </div>
    </li>
  );
}
