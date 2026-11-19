import { describe, expect, it } from 'vitest';
import {
  aendereTimerEinstellung,
  aktualisiereTimer,
  berechneFortschrittProzent,
  bereinigeEinstellung,
  erstelleBereitZustand,
  MAX_PAUSE_SEKUNDEN,
  MAX_TRAINING_SEKUNDEN,
  MIN_PAUSE_SEKUNDEN,
  MIN_TRAINING_SEKUNDEN,
  pausiereTimer,
  restSekundenAnzeige,
  setzeTimerFort,
  setzeTimerZurueck,
  STANDARD_TIMER_EINSTELLUNG,
  starteTimer,
} from './logik';

describe('Timer-Logik (rein, zeitstempel-basiert)', () => {
  it('verwendet Standardwerte 30 s Training und 10 s Pause', () => {
    const zustand = erstelleBereitZustand();

    expect(zustand.phase).toBe('bereit');
    expect(zustand.einstellung).toEqual(STANDARD_TIMER_EINSTELLUNG);
    expect(zustand.runde).toBe(1);
    expect(restSekundenAnzeige(zustand)).toBe(30);
    expect(berechneFortschrittProzent(zustand)).toBe(100);
  });

  it('begrenzt ungültige Trainings- und Pauseneinstellungen sauber auf Min/Max', () => {
    expect(bereinigeEinstellung({ trainingSekunden: 0, pauseSekunden: -5 })).toEqual({
      trainingSekunden: MIN_TRAINING_SEKUNDEN,
      pauseSekunden: MIN_PAUSE_SEKUNDEN,
    });

    expect(bereinigeEinstellung({ trainingSekunden: 99_999, pauseSekunden: 120_000 })).toEqual({
      trainingSekunden: MAX_TRAINING_SEKUNDEN,
      pauseSekunden: MAX_PAUSE_SEKUNDEN,
    });

    expect(bereinigeEinstellung({ trainingSekunden: Number.NaN, pauseSekunden: Number.POSITIVE_INFINITY })).toEqual(
      STANDARD_TIMER_EINSTELLUNG,
    );

    expect(bereinigeEinstellung({ trainingSekunden: 45.6, pauseSekunden: 12.2 })).toEqual({
      trainingSekunden: 46,
      pauseSekunden: 12,
    });
  });

  it('übernimmt geänderte Einstellungen im Zustand bereit sofort', () => {
    const bereit = erstelleBereitZustand();
    const geaendert = aendereTimerEinstellung(bereit, { trainingSekunden: 45, pauseSekunden: 15 });

    expect(geaendert.phase).toBe('bereit');
    expect(geaendert.einstellung).toEqual({ trainingSekunden: 45, pauseSekunden: 15 });
    expect(restSekundenAnzeige(geaendert)).toBe(45);
    expect(geaendert.gesamtMs).toBe(45_000);
  });

  it('wechselt exakt zwischen Training und Pause und zählt Runden hoch', () => {
    const start = starteTimer(erstelleBereitZustand({ trainingSekunden: 30, pauseSekunden: 10 }), 1_000);
    expect(start.phase).toBe('training');
    expect(start.runde).toBe(1);
    expect(start.phasenEndeMs).toBe(31_000);

    // Mitten im Training: kein Phasenwechsel
    const mitte = aktualisiereTimer(start, 16_000);
    expect(mitte.phasenWechsel).toBeNull();
    expect(mitte.zustand.phase).toBe('training');
    expect(restSekundenAnzeige(mitte.zustand)).toBe(15);
    expect(berechneFortschrittProzent(mitte.zustand)).toBe(50);

    // Exakter Übergang Training -> Pause
    const inPause = aktualisiereTimer(mitte.zustand, 31_050);
    expect(inPause.phasenWechsel).toBe('pause');
    expect(inPause.zustand.phase).toBe('pause');
    expect(inPause.zustand.runde).toBe(1);
    expect(inPause.zustand.phasenEndeMs).toBe(41_000);
    expect(restSekundenAnzeige(inPause.zustand)).toBe(10);

    // Folgetakt in der Pause löst KEIN weiteres Signal aus (Einmaligkeit)
    const naechsterTakt = aktualisiereTimer(inPause.zustand, 31_300);
    expect(naechsterTakt.phasenWechsel).toBeNull();
    expect(naechsterTakt.zustand.phase).toBe('pause');

    // Übergang Pause -> Training (Runde 2)
    const runde2 = aktualisiereTimer(naechsterTakt.zustand, 41_020);
    expect(runde2.phasenWechsel).toBe('training');
    expect(runde2.zustand.phase).toBe('training');
    expect(runde2.zustand.runde).toBe(2);
    expect(runde2.zustand.phasenEndeMs).toBe(71_000);
    expect(restSekundenAnzeige(runde2.zustand)).toBe(30);
  });

  it('überspringt die Pause komplett bei pauseSekunden = 0 und startet direkt die nächste Runde', () => {
    const start = starteTimer(erstelleBereitZustand({ trainingSekunden: 10, pauseSekunden: 0 }), 0);

    const nach10s = aktualisiereTimer(start, 10_050);
    expect(nach10s.phasenWechsel).toBe('training');
    expect(nach10s.zustand.phase).toBe('training');
    expect(nach10s.zustand.runde).toBe(2);
    expect(nach10s.zustand.phasenEndeMs).toBe(20_000);
    expect(restSekundenAnzeige(nach10s.zustand)).toBe(10);

    // Folgetakt innerhalb Runde 2 liefert keinen Wechsel
    const danach = aktualisiereTimer(nach10s.zustand, 10_300);
    expect(danach.phasenWechsel).toBeNull();
  });

  it('berechnet lange Zeitsprünge über viele Phasen exakt und meldet nur den letzten Phasenwechsel', () => {
    // Zyklus: 30 s Training + 10 s Pause = 40 s
    // [0,30) R1 Training, [30,40) R1 Pause, [40,70) R2 Training,
    // [70,80) R2 Pause, [80,110) R3 Training, [110,120) R3 Pause
    const start = starteTimer(erstelleBereitZustand({ trainingSekunden: 30, pauseSekunden: 10 }), 0);

    const sprungInPause = aktualisiereTimer(start, 115_000);
    expect(sprungInPause.phasenWechsel).toBe('pause');
    expect(sprungInPause.zustand.phase).toBe('pause');
    expect(sprungInPause.zustand.runde).toBe(3);
    expect(sprungInPause.zustand.restMs).toBe(5_000);
    expect(sprungInPause.zustand.phasenEndeMs).toBe(120_000);

    // Exakt auf einer Grenze landen (110 s -> Start von R3 Pause mit vollen 10 s)
    const sprungAufGrenze = aktualisiereTimer(start, 110_000);
    expect(sprungAufGrenze.phasenWechsel).toBe('pause');
    expect(sprungAufGrenze.zustand.phase).toBe('pause');
    expect(sprungAufGrenze.zustand.runde).toBe(3);
    expect(sprungAufGrenze.zustand.restMs).toBe(10_000);

    // Sehr langer Sprung (10 Stunden bei 1 s Training, 0 s Pause -> O(1) ohne Schleifen-Hänger)
    const kurzStart = starteTimer(erstelleBereitZustand({ trainingSekunden: 1, pauseSekunden: 0 }), 0);
    const nachZehnStunden = aktualisiereTimer(kurzStart, 36_000_500);
    expect(nachZehnStunden.phasenWechsel).toBe('training');
    expect(nachZehnStunden.zustand.runde).toBe(36_001);
    expect(nachZehnStunden.zustand.restMs).toBe(500);
  });

  it('merkt sich beim Pausieren Phase und Restzeit und setzt nahtlos fort', () => {
    const start = starteTimer(erstelleBereitZustand({ trainingSekunden: 30, pauseSekunden: 10 }), 0);
    const inPause = aktualisiereTimer(start, 34_000).zustand; // Pause, 6 s übrig
    expect(inPause.phase).toBe('pause');
    expect(inPause.restMs).toBe(6_000);

    const pausiert = pausiereTimer(inPause, 35_000); // Pause, 5 s übrig
    expect(pausiert.phase).toBe('pausiert');
    expect(pausiert.pausiertePhase).toBe('pause');
    expect(pausiert.restMs).toBe(5_000);
    expect(pausiert.phasenEndeMs).toBeNull();

    // Während pausiert verändert verstrichene Zeit nichts und löst keinen Wechsel aus
    const stillstand = aktualisiereTimer(pausiert, 100_000);
    expect(stillstand.phasenWechsel).toBeNull();
    expect(stillstand.zustand.restMs).toBe(5_000);

    // Fortsetzen nach 65 s Pause: exakt 5 s Pausenzeit verbleiben
    const fortgesetzt = setzeTimerFort(pausiert, 100_000);
    expect(fortgesetzt.phase).toBe('pause');
    expect(fortgesetzt.phasenEndeMs).toBe(105_000);
    expect(restSekundenAnzeige(fortgesetzt)).toBe(5);

    const nachFortsetzen = aktualisiereTimer(fortgesetzt, 105_000);
    expect(nachFortsetzen.phasenWechsel).toBe('training');
    expect(nachFortsetzen.zustand.runde).toBe(2);
  });

  it('setzt den Timer sauber in den Bereit-Zustand zurück', () => {
    const start = starteTimer(erstelleBereitZustand({ trainingSekunden: 45, pauseSekunden: 15 }), 0);
    const runde2 = aktualisiereTimer(start, 65_000).zustand;
    expect(runde2.runde).toBe(2);

    const zurueck = setzeTimerZurueck(runde2);
    expect(zurueck.phase).toBe('bereit');
    expect(zurueck.runde).toBe(1);
    expect(zurueck.restMs).toBe(45_000);
    expect(zurueck.phasenEndeMs).toBeNull();
    expect(zurueck.einstellung).toEqual({ trainingSekunden: 45, pauseSekunden: 15 });
  });
});
