/*
 * Zentraler Formatierer für Dauern (Entscheidungen E11 und E21).
 *
 * Dauern sind projektweit ganze Sekunden. Anzeige:
 * - unter 3600 s `mm:ss` (z. B. `00:30`, `59:59`),
 * - ab 3600 s `h:mm:ss` (z. B. `1:00:00`, höchstens `24:00:00`).
 * Zusätzlich liefert die Funktion ein `aria-label` in Worten, weil
 * Screenreader `00:30` sonst als Ziffern und Doppelpunkt vorlesen.
 */

/** Größte darstellbare Dauer: 24 Stunden (Obergrenze der Timer-Einstellung). */
export const DAUER_MAX_SEKUNDEN = 86_400;

export interface FormatierteDauer {
  /** Sichtbarer Text, `mm:ss` oder `h:mm:ss`. */
  text: string;
  /** Dieselbe Dauer in Worten, z. B. "1 Minute und 5 Sekunden". */
  ariaLabel: string;
}

function zweistellig(wert: number): string {
  return String(wert).padStart(2, '0');
}

function einheit(anzahl: number, einzahl: string, mehrzahl: string): string {
  return `${anzahl} ${anzahl === 1 ? einzahl : mehrzahl}`;
}

function aufzaehlung(teile: string[]): string {
  if (teile.length <= 1) return teile.join('');
  return `${teile.slice(0, -1).join(', ')} und ${teile[teile.length - 1]}`;
}

/**
 * Formatiert eine Dauer in ganzen Sekunden (0 bis 86400).
 * @throws RangeError bei negativen, nicht ganzzahligen oder zu großen Werten.
 */
export function formatiereDauer(sekunden: number): FormatierteDauer {
  if (!Number.isInteger(sekunden) || sekunden < 0 || sekunden > DAUER_MAX_SEKUNDEN) {
    throw new RangeError(
      `Dauer muss eine ganze Zahl von 0 bis ${DAUER_MAX_SEKUNDEN} Sekunden sein, war: ${sekunden}`,
    );
  }

  const stunden = Math.floor(sekunden / 3600);
  const minuten = Math.floor((sekunden % 3600) / 60);
  const rest = sekunden % 60;

  const text =
    stunden > 0
      ? `${stunden}:${zweistellig(minuten)}:${zweistellig(rest)}`
      : `${zweistellig(minuten)}:${zweistellig(rest)}`;

  const teile: string[] = [];
  if (stunden > 0) teile.push(einheit(stunden, 'Stunde', 'Stunden'));
  if (minuten > 0) teile.push(einheit(minuten, 'Minute', 'Minuten'));
  if (rest > 0 || teile.length === 0) teile.push(einheit(rest, 'Sekunde', 'Sekunden'));

  return { text, ariaLabel: aufzaehlung(teile) };
}
