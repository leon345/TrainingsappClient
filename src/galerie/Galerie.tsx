import type { ReactNode } from 'react';
import { Button, Card, ICON_NAMEN, Icon, IconButton, TextField } from '../components/ui';
import './Galerie.css';

/**
 * Komponentengalerie (galerie.html). Zeigt Tokens und Grundkomponenten
 * an einer Stelle. Grundlage der visuellen Playwright-Tests (e2e/visuell.spec.ts).
 * Keine Fachoberfläche und nicht aus der App verlinkt.
 */

const FARBROLLEN = [
  ['primary', 'on-primary'],
  ['primary-container', 'on-primary-container'],
  ['secondary', 'on-secondary'],
  ['secondary-container', 'on-secondary-container'],
  ['tertiary', 'on-tertiary'],
  ['tertiary-container', 'on-tertiary-container'],
  ['error', 'on-error'],
  ['error-container', 'on-error-container'],
  ['surface', 'on-surface'],
  ['surface-container-low', 'on-surface'],
  ['surface-container', 'on-surface'],
  ['surface-container-highest', 'on-surface-variant'],
  ['inverse-surface', 'inverse-on-surface'],
  ['outline', 'surface'],
] as const;

const TYPO_ROLLEN = [
  'display-small',
  'headline-medium',
  'headline-small',
  'title-large',
  'title-medium',
  'body-large',
  'body-medium',
  'label-large',
  'label-small',
] as const;

const FORMEN = [
  'extra-small',
  'small',
  'medium',
  'large',
  'large-increased',
  'extra-large',
  'extra-large-increased',
  'extra-extra-large',
  'full',
] as const;

function Abschnitt({ id, titel, children }: { id: string; titel: string; children: ReactNode }) {
  return (
    <section className="galerie__abschnitt" aria-labelledby={`${id}-titel`} data-testid={id}>
      <h2 id={`${id}-titel`} className="md-typescale-title-large">
        {titel}
      </h2>
      {children}
    </section>
  );
}

export function Galerie() {
  return (
    <main className="galerie">
      <h1 className="md-typescale-emphasized-headline-medium">Komponentengalerie</h1>

      <Abschnitt id="buttons" titel="Buttons">
        <div className="galerie__reihe">
          <Button variant="filled">Filled</Button>
          <Button variant="tonal">Tonal</Button>
          <Button variant="outlined">Outlined</Button>
          <Button variant="text">Text</Button>
        </div>
        <div className="galerie__reihe">
          <Button variant="filled" icon="play_arrow">
            Start
          </Button>
          <Button variant="tonal" icon="pause">
            Pause
          </Button>
          <Button variant="filled" shape="square">
            Eckig
          </Button>
          <Button variant="filled" isDisabled>
            Deaktiviert
          </Button>
          <Button variant="outlined" isDisabled>
            Deaktiviert
          </Button>
        </div>
        <div className="galerie__reihe">
          <Button variant="filled" size="medium" icon="play_arrow">
            Training starten
          </Button>
          <Button variant="tonal" size="medium" shape="square">
            Mittel eckig
          </Button>
        </div>
      </Abschnitt>

      <Abschnitt id="icon-buttons" titel="Icon-Buttons">
        <div className="galerie__reihe">
          <IconButton icon="settings" aria-label="Einstellungen" />
          <IconButton icon="add" variant="filled" aria-label="Hinzufügen" />
          <IconButton icon="edit" variant="tonal" aria-label="Bearbeiten" />
          <IconButton icon="delete" variant="outlined" aria-label="Löschen" />
          <IconButton icon="close" isDisabled aria-label="Schließen" />
        </div>
      </Abschnitt>

      <Abschnitt id="textfelder" titel="Textfelder">
        <div className="galerie__spalte">
          <TextField label="Titel" />
          <TextField label="Name des Passkeys" defaultValue="Smartphone" description="Hilft beim Wiederfinden" />
          <TextField label="Notiz" isInvalid defaultValue="x" errorMessage="Höchstens 500 Zeichen" />
          <TextField label="Deaktiviert" isDisabled />
        </div>
      </Abschnitt>

      <Abschnitt id="cards" titel="Cards">
        <div className="galerie__raster">
          <Card variant="filled">
            <h3 className="md-typescale-title-medium">Filled Card</h3>
            <p className="md-typescale-body-medium">Container surface-container-highest.</p>
          </Card>
          <Card variant="outlined">
            <h3 className="md-typescale-title-medium">Outlined Card</h3>
            <p className="md-typescale-body-medium">Rand outline-variant.</p>
          </Card>
        </div>
      </Abschnitt>

      <Abschnitt id="icons" titel="Icons">
        <ul className="galerie__icons">
          {ICON_NAMEN.map((name) => (
            <li key={name}>
              <Icon name={name} />
              <span className="md-typescale-label-small">{name}</span>
            </li>
          ))}
        </ul>
      </Abschnitt>

      <Abschnitt id="farben" titel="Farbrollen">
        <ul className="galerie__farben">
          {FARBROLLEN.map(([flaeche, text]) => (
            <li
              key={flaeche}
              style={{
                background: `var(--md-sys-color-${flaeche})`,
                color: `var(--md-sys-color-${text})`,
              }}
            >
              <span className="md-typescale-label-medium">{flaeche}</span>
            </li>
          ))}
        </ul>
      </Abschnitt>

      <Abschnitt id="typografie" titel="Typografie">
        {TYPO_ROLLEN.map((rolle) => (
          <div key={rolle} className="galerie__typo">
            <p className={`md-typescale-${rolle}`}>{rolle}</p>
            <p className={`md-typescale-emphasized-${rolle}`}>{rolle} emphasized</p>
          </div>
        ))}
      </Abschnitt>

      <Abschnitt id="formen" titel="Formen">
        <ul className="galerie__formen">
          {FORMEN.map((form) => (
            <li key={form}>
              <span
                className="galerie__form"
                style={{ borderRadius: `var(--md-sys-shape-corner-${form})` }}
              />
              <span className="md-typescale-label-small">{form}</span>
            </li>
          ))}
        </ul>
      </Abschnitt>
    </main>
  );
}
