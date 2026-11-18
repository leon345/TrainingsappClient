import { useRef, useState, type ReactNode } from 'react';
import { Button, Card, CircularProgress, NumberField } from '../components/ui';
import { formatiereDauer } from '../format/dauer';
import {
  GRENZEN,
  ladeEinstellung,
  speichereEinstellung,
  type TimerEinstellung,
} from './einstellung';
import type { Phase } from './logik';
import { useTimer } from './useTimer';
import { useWakeLock } from './useWakeLock';
import './TimerAnsicht.css';

const PHASE_NAME: Record<Phase, string> = { training: 'Training', pause: 'Pause' };

/** Dauer sichtbar als `mm:ss`, für Screenreader in Worten (E21). */
function DauerText({ sekunden }: { sekunden: number }): ReactNode {
  const dauer = formatiereDauer(sekunden);
  return (
    <>
      <span aria-hidden="true">{dauer.text}</span>
      <span className="nur-screenreader">{dauer.ariaLabel}</span>
    </>
  );
}

export interface TimerAnsichtProps {
  /** Austauschbare Uhr für Tests; Standard `Date.now`. */
  uhr?: () => number;
}

/**
 * Intervalltimer (C-02): Trainings- und Pausenzeit einstellen, starten,
 * anhalten, fortsetzen, zurücksetzen. Die Einstellung wird lokal gespeichert
 * (E10); die Runden wiederholen sich, bis der Benutzer anhält.
 */
export function TimerAnsicht({ uhr }: TimerAnsichtProps) {
  const [einstellung, setEinstellung] = useState<TimerEinstellung>(() => ladeEinstellung());
  const timer = useTimer(einstellung, uhr);
  const { zustand, stand } = timer;
  const hauptButton = useRef<HTMLButtonElement>(null);

  const bereit = zustand.status === 'bereit';
  const laeuft = zustand.status === 'laeuft';
  useWakeLock(laeuft);

  const aendere = (feld: keyof TimerEinstellung) => (wert: number) => {
    // Ein geleertes Feld meldet NaN; dann bleibt der bisherige Wert.
    if (!Number.isInteger(wert)) return;
    const neu = { ...einstellung, [feld]: wert };
    setEinstellung(neu);
    speichereEinstellung(neu);
  };

  const rest = formatiereDauer(stand.restSekunden);
  const zeitLang = stand.restSekunden >= 3600;
  const ansage = laeuft ? `${PHASE_NAME[stand.phase]}, Runde ${stand.runde}` : bereit ? '' : 'Angehalten';

  const sperrHinweis = bereit ? null : <> Zum Ändern zurücksetzen.</>;

  return (
    <section className="timer" aria-labelledby="timer-titel" data-phase={stand.phase} data-status={zustand.status}>
      <h2 id="timer-titel" className="timer__titel md-typescale-headline-small">
        Intervalltimer
      </h2>

      <div className="timer__anzeige">
        <CircularProgress
          size={256}
          thickness={12}
          value={stand.fortschritt * 100}
          aria-label={`Fortschritt ${PHASE_NAME[stand.phase]}`}
          valueLabel={`${Math.floor(stand.fortschritt * 100)} %`}
          className="timer__ring"
        >
          <p className="timer__phase md-typescale-title-large">{PHASE_NAME[stand.phase]}</p>
          <div
            role="timer"
            aria-label={`Restzeit ${rest.ariaLabel}`}
            className={`timer__zeit ${zeitLang ? 'md-typescale-display-small' : 'md-typescale-display-large'}`}
          >
            {rest.text}
          </div>
          <p className="timer__runde md-typescale-title-medium">
            {bereit ? 'Bereit' : `Runde ${stand.runde}`}
            {zustand.status === 'pausiert' && ' · angehalten'}
          </p>
        </CircularProgress>
        {/* Ansage nur bei Phasenwechsel und Anhalten, nicht jede Sekunde. */}
        <p role="status" className="nur-screenreader">
          {ansage}
        </p>
      </div>

      <div className="timer__steuerung">
        <Button
          ref={hauptButton}
          size="large"
          variant={laeuft ? 'tonal' : 'filled'}
          icon={laeuft ? 'pause' : 'play_arrow'}
          onPress={laeuft ? timer.pausiere : timer.starte}
        >
          {laeuft ? 'Anhalten' : bereit ? 'Start' : 'Fortsetzen'}
        </Button>
        <Button
          size="medium"
          variant="outlined"
          icon="restart_alt"
          isDisabled={bereit}
          onPress={() => {
            timer.setzeZurueck();
            hauptButton.current?.focus();
          }}
        >
          Zurücksetzen
        </Button>
      </div>

      <Card elementType="section" variant="outlined" className="timer__einstellung" aria-labelledby="einstellung-titel">
        <h3 id="einstellung-titel" className="md-typescale-title-medium">
          Einstellung
        </h3>
        <div className="timer__felder">
          <NumberField
            label="Training in Sekunden"
            value={einstellung.trainingSekunden}
            minValue={GRENZEN.trainingSekunden.min}
            maxValue={GRENZEN.trainingSekunden.max}
            isDisabled={!bereit}
            onChange={aendere('trainingSekunden')}
            description={
              <>
                {GRENZEN.trainingSekunden.min} bis {GRENZEN.trainingSekunden.max}, entspricht{' '}
                <DauerText sekunden={einstellung.trainingSekunden} />.{sperrHinweis}
              </>
            }
          />
          <NumberField
            label="Pause in Sekunden"
            value={einstellung.pauseSekunden}
            minValue={GRENZEN.pauseSekunden.min}
            maxValue={GRENZEN.pauseSekunden.max}
            isDisabled={!bereit}
            onChange={aendere('pauseSekunden')}
            description={
              <>
                {GRENZEN.pauseSekunden.min} bis {GRENZEN.pauseSekunden.max}, 0 = keine Pause, entspricht{' '}
                <DauerText sekunden={einstellung.pauseSekunden} />.{sperrHinweis}
              </>
            }
          />
        </div>
      </Card>
    </section>
  );
}
