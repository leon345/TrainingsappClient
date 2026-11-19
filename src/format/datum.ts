const REINES_DATUM = /^(\d{4})-(\d{2})-(\d{2})$/;

const DEUTSCHES_DATUM_FORMAT = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * Formatiert ein ISO-Datum (YYYY-MM-DD) oder einen ISO-Zeitstempel in UTC
 * deterministisch ins deutsche Datumsformat TT.MM.JJJJ.
 */
export function formatiereDatum(isoWert: string): string {
  const bereinigt = isoWert.trim();
  const reinerTreffer = REINES_DATUM.exec(bereinigt);

  if (reinerTreffer) {
    const jahr = Number(reinerTreffer[1]);
    const monat = Number(reinerTreffer[2]);
    const tag = Number(reinerTreffer[3]);
    const datum = new Date(Date.UTC(jahr, monat - 1, tag));

    if (
      datum.getUTCFullYear() !== jahr ||
      datum.getUTCMonth() !== monat - 1 ||
      datum.getUTCDate() !== tag
    ) {
      throw new RangeError(`Ungueltiges Kalenderdatum: ${isoWert}`);
    }

    return DEUTSCHES_DATUM_FORMAT.format(datum);
  }

  const zeitstempel = Date.parse(bereinigt);
  if (Number.isNaN(zeitstempel)) {
    throw new RangeError(`Ungueltiges ISO-Datum: ${isoWert}`);
  }

  return DEUTSCHES_DATUM_FORMAT.format(new Date(zeitstempel));
}
