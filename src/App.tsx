import { useEffect, useRef, useState } from 'react';
import { Button } from './components/ui';
import { KontoAnsicht } from './konto/KontoAnsicht';
import { erzeugeKontoSteuerung, type KontoSteuerung } from './konto/steuerung';
import { TimerAnsicht } from './timer/TimerAnsicht';

export type Ansicht = 'timer' | 'konto';

export interface AppProps {
  /** Konto-Steuerung, im Test ersetzbar; Standard: echte API und WebAuthn. */
  kontoSteuerung?: KontoSteuerung;
  /** Uhr des Timers, im Test ersetzbar; Standard `Date.now`. */
  uhr?: () => number;
}

/**
 * Anwendungsrahmen. Startseite ist der Intervalltimer (C-02). Daneben gibt es
 * die Konto-Ansicht (C-03); umgeschaltet wird ohne Routing-Bibliothek.
 *
 * Der Timer bleibt beim Wechsel eingehängt und wird nur verborgen (`hidden`).
 * So läuft ein laufender Timer weiter, samt Ton, Vibration und Wake Lock,
 * und wird nicht zurückgesetzt. Die Konto-Ansicht wird erst beim Öffnen
 * eingehängt; erst dann gibt es einen Aufruf an den Server. Der Timer
 * braucht also weder Anmeldung noch Server.
 *
 * Die Navigation steht im DOM hinter dem Inhalt (unten, wie die
 * M3-Navigationsleiste), damit Tab weiter zuerst den Start-Button erreicht.
 */
export function App({ kontoSteuerung, uhr }: AppProps) {
  const [ansicht, setAnsicht] = useState<Ansicht>('timer');
  const [steuerung] = useState(() => kontoSteuerung ?? erzeugeKontoSteuerung());

  // Nach einem Wechsel den Fokus auf die Überschrift der neuen Ansicht setzen,
  // nicht beim ersten Laden.
  const erster = useRef(true);
  useEffect(() => {
    if (erster.current) {
      erster.current = false;
      return;
    }
    document.getElementById(ansicht === 'timer' ? 'timer-titel' : 'konto-titel')?.focus();
  }, [ansicht]);

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title md-typescale-title-large">Trainingsapp</h1>
      </header>
      <main className="app__main">
        <div hidden={ansicht !== 'timer'}>
          <TimerAnsicht uhr={uhr} />
        </div>
        {ansicht === 'konto' && <KontoAnsicht steuerung={steuerung} />}
      </main>
      <nav className="app__navigation" aria-label="Ansicht">
        <NavigationsKnopf ansicht="timer" aktiv={ansicht} wechsle={setAnsicht} />
        <NavigationsKnopf ansicht="konto" aktiv={ansicht} wechsle={setAnsicht} />
      </nav>
    </div>
  );
}

const NAVIGATION = {
  timer: { text: 'Timer', icon: 'timer' },
  konto: { text: 'Konto', icon: 'key' },
} as const;

function NavigationsKnopf({
  ansicht,
  aktiv,
  wechsle,
}: {
  ansicht: Ansicht;
  aktiv: Ansicht;
  wechsle: (a: Ansicht) => void;
}) {
  const istAktiv = ansicht === aktiv;
  return (
    <Button
      size="medium"
      variant={istAktiv ? 'tonal' : 'text'}
      icon={NAVIGATION[ansicht].icon}
      aria-current={istAktiv ? 'page' : undefined}
      onPress={() => wechsle(ansicht)}
    >
      {NAVIGATION[ansicht].text}
    </Button>
  );
}
