/**
 * Kalendertag aus der API (`YYYY-MM-DD`, UTC, z. B. `erstelltAm` eines
 * Passkeys, E29) als deutsches Datum `TT.MM.JJJJ`. Der Tag wird nur
 * umgestellt, nicht in eine Zeitzone umgerechnet; sonst könnte er sich um
 * einen Tag verschieben. Unlesbare Werte bleiben unverändert.
 */
export function formatiereTag(tag: string): string {
  const treffer = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tag);
  if (!treffer) return tag;
  const [, jahr, monat, tagImMonat] = treffer;
  return `${tagImMonat}.${monat}.${jahr}`;
}
