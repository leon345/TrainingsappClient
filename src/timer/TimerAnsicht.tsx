import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, Card, CircularProgress, Icon, NumberField, Switch } from '../components/ui';
import { formatiereDauer } from '../format/dauer';
import {
  GRENZEN,
  ladeEinstellung,
  speichereEinstellung,
  type TimerEinstellung,
} from './einstellung';
import { GeraeteSignal } from './geraeteSignal';
import type { Phase } from './logik';
import {
  ladeSignalEinstellung,
  speichereSignalEinstellung,
  type SignalEinstellung,
} from './signalEinstellung';
import { usePhasenwechsel } from './usePhasenwechsel';
import { useTimer } from './useTimer';
import { vibrationVerfuegbar } from './vibration';
import { useWakeLock } from './useWakeLock';
import './TimerAnsicht.css';

const PHASE_NAME: Record<Phase, string> = { training: 'Training', pause: 'Pause' };
const PHASE_ICON = { training: 'fitness_center', pause: 'pause' } as const;

/**
 * Dauer sichtbar als `mm:ss`, für Screenreader in Worten (E21). Satzzeichen
 * danach gehören in beide Fassungen, sonst trennen manche Browser sie beim
 * Vorlesen mit einem Leerzeichen ab.
 */
function DauerText({ sekunden, danach = '' }: { sekunden: number; danach?: string }): ReactNode {
  const dauer = formatiereDauer(sekunden);
  return (
    <>
      <span aria-hidden="true">{dauer.text + danach}</span>
      <span className="nur-screenreader">{dauer.ariaLabel + danach}</span>
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
 *
 * Phasensignale (C-17, E33): Jeder Wechsel wird genau einmal gemeldet
 * (`usePhasenwechsel`), hörbar und fühlbar je nach Schalter (`GeraeteSignal`)
 * und immer sichtbar: Die Phasenanzeige unter dem Ring wechselt Text und
 * Farbe. Sie ist zugleich die einzige Live-Region (`role="status"`,
 * `aria-live="polite"`), damit Screenreader den Wechsel nur einmal ansagen.
 */
export function TimerAnsicht({ uhr }: TimerAnsichtProps) {
  const [einstellung, setEinstellung] = useState<TimerEinstellung>(() => ladeEinstellung());
  const timer = useTimer(einstellung, uhr);
  const { zustand, stand } = timer;
  const hauptButton = useRef<HTMLButtonElement>(null);

  const bereit = zustand.status === 'bereit';
  const laeuft = zustand.status === 'laeuft';
  useWakeLock(laeuft);

  const [vibrationMoeglich] = useState(() => vibrationVerfuegbar());
  const [schalter, setSchalter] = useState<SignalEinstellung>(() => ladeSignalEinstellung());
  // Wirksame Schalter für das Gerätesignal; ohne Vibrations-API nie vibrieren.
  const wirksam = useRef(schalter);
  wirksam.current = { ton: schalter.ton, vibration: schalter.vibration && vibrationMoeglich };
  const [geraet] = useState(() => new GeraeteSignal(() => wirksam.current));
  useEffect(() => () => geraet.beende(), [geraet]);
  usePhasenwechsel(zustand, stand, geraet);

  const schalte = (feld: keyof SignalEinstellung) => (an: boolean) => {
    const neu = { ...schalter, [feld]: an };
    setSchalter(neu);
    speichereSignalEinstellung(neu);
    if (feld === 'ton' && an) {
      // Einschalten ist eine Nutzeraktion: Ton hier entsperren.
      wirksam.current = { ...wirksam.current, ton: true };
      geraet.entsperreTon();
    }
  };

  const starte = () => {
    // Synchron im Tippen auf Start/Fortsetzen, sonst blockiert der Browser den Ton.
    geraet.entsperreTon();
    timer.starte();
  };

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

  const sperrHinweis = bereit ? null : ' Zum Ändern zurücksetzen.';

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
        {/*
          Sichtbares Signal und einzige Ansage (C-17): Text und Farbe wechseln
          mit der Phase. Angesagt wird nur bei Phasenwechsel und Anhalten,
          nicht jede Sekunde.
        */}
        <p
          role="status"
          aria-live="polite"
          className="timer__signal md-typescale-label-large"
          data-signal={laeuft ? stand.phase : bereit ? 'leer' : 'angehalten'}
        >
          {laeuft && <Icon name={PHASE_ICON[stand.phase]} size={18} />}
          {ansage}
        </p>
      </div>

      <div className="timer__steuerung">
        <Button
          ref={hauptButton}
          size="large"
          variant={laeuft ? 'tonal' : 'filled'}
          icon={laeuft ? 'pause' : 'play_arrow'}
          onPress={laeuft ? timer.pausiere : starte}
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
                <DauerText sekunden={einstellung.trainingSekunden} danach="." />
                {sperrHinweis}
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
                <DauerText sekunden={einstellung.pauseSekunden} danach="." />
                {sperrHinweis}
              </>
            }
          />
        </div>
        <h4 id="signal-titel" className="timer__signal-titel md-typescale-title-small">
          Signal beim Phasenwechsel
        </h4>
        <div className="timer__schalter" role="group" aria-labelledby="signal-titel">
          <Switch label="Ton" isSelected={schalter.ton} onChange={schalte('ton')} />
          <Switch
            label="Vibration"
            isSelected={schalter.vibration && vibrationMoeglich}
            isDisabled={!vibrationMoeglich}
            onChange={schalte('vibration')}
            description={vibrationMoeglich ? undefined : 'Dieser Browser unterstützt keine Vibration.'}
          />
        </div>
      </Card>
    </section>
  );
}
