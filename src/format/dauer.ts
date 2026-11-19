export const MAX_DAUER_SEKUNDEN = 86_400; // 24:00:00

function pruefeSekunden(sekunden: number): void {
  if (!Number.isInteger(sekunden) || sekunden < 0 || sekunden > MAX_DAUER_SEKUNDEN) {
    throw new RangeError(
      `Ungueltige Dauer: ${String(sekunden)}. Erwartet wird eine ganze Zahl zwischen 0 und ${MAX_DAUER_SEKUNDEN}.`,
    );
  }
}

function zweistellig(wert: number): string {
  return String(wert).padStart(2, '0');
}

/**
 * Formatiert ganze Sekunden nach Projektbeschluss E11/E21:
 * - unter 3600 s: mm:ss (z. B. 00:30, 59:59)
 * - ab 3600 s: h:mm:ss (z. B. 1:00:00 bis 24:00:00)
 */
export function formatiereDauer(sekunden: number): string {
  pruefeSekunden(sekunden);

  const stunden = Math.floor(sekunden / 3600);
  const minuten = Math.floor((sekunden % 3600) / 60);
  const restSekunden = sekunden % 60;

  if (stunden > 0) {
    return `${stunden}:${zweistellig(minuten)}:${zweistellig(restSekunden)}`;
  }

  return `${zweistellig(minuten)}:${zweistellig(restSekunden)}`;
}

/**
 * Liefert eine ausgeschriebene deutsche Zeitangabe fuer Screenreader (aria-label).
 */
export function dauerAlsWorte(sekunden: number): string {
  pruefeSekunden(sekunden);

  if (sekunden === 0) {
    return '0 Sekunden';
  }

  const stunden = Math.floor(sekunden / 3600);
  const minuten = Math.floor((sekunden % 3600) / 60);
  const restSekunden = sekunden % 60;

  const teile: string[] = [];
  if (stunden > 0) {
    teile.push(stunden === 1 ? '1 Stunde' : `${stunden} Stunden`);
  }
  if (minuten > 0) {
    teile.push(minuten === 1 ? '1 Minute' : `${minuten} Minuten`);
  }
  if (restSekunden > 0) {
    teile.push(restSekunden === 1 ? '1 Sekunde' : `${restSekunden} Sekunden`);
  }

  if (teile.length === 1) {
    return teile[0]!;
  }
  if (teile.length === 2) {
    return `${teile[0]} und ${teile[1]}`;
  }
  return `${teile[0]}, ${teile[1]} und ${teile[2]}`;
}
