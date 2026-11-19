export const BENUTZERNAME_MUSTER = /^[a-z0-9](?:[a-z0-9]|[._-](?=[a-z0-9])){2,31}$/;

export const BENUTZERNAME_SPERRLISTE: ReadonlySet<string> = new Set([
  'admin',
  'root',
  'system',
  'support',
  'trainingsapp',
]);

export const PASSKEY_BEZEICHNUNG_MAX_LAENGE = 50;

export interface BenutzernamePruefung {
  readonly gueltig: boolean;
  readonly normalisiert: string;
  readonly fehler: string | null;
}

export interface PasskeyBezeichnungPruefung {
  readonly gueltig: boolean;
  readonly bereinigt: string;
  readonly fehler: string | null;
}

export function normalisiereBenutzername(eingabe: string): string {
  return eingabe.toLowerCase();
}

export function pruefeBenutzername(eingabe: string): BenutzernamePruefung {
  const normalisiert = normalisiereBenutzername(eingabe);

  if (normalisiert.length === 0) {
    return {
      gueltig: false,
      normalisiert,
      fehler: 'Bitte gib einen Benutzernamen (Pseudonym) ein.',
    };
  }

  if (/\s/.test(normalisiert)) {
    return {
      gueltig: false,
      normalisiert,
      fehler: 'Der Benutzername darf keine Leerzeichen enthalten.',
    };
  }

  if (normalisiert.length < 3 || normalisiert.length > 32) {
    return {
      gueltig: false,
      normalisiert,
      fehler: 'Der Benutzername muss zwischen 3 und 32 Zeichen lang sein.',
    };
  }

  if (!BENUTZERNAME_MUSTER.test(normalisiert)) {
    return {
      gueltig: false,
      normalisiert,
      fehler:
        'Erlaubt sind nur a–z, 0–9 sowie ., _ oder - (nicht am Anfang, am Ende oder direkt hintereinander).',
    };
  }

  if (BENUTZERNAME_SPERRLISTE.has(normalisiert)) {
    return {
      gueltig: false,
      normalisiert,
      fehler: 'Dieser Benutzername ist reserviert. Bitte wähle ein anderes Pseudonym.',
    };
  }

  return {
    gueltig: true,
    normalisiert,
    fehler: null,
  };
}

// Unicode-Kategorien für Steuer-, Format-, Zeilen- und Absatztrenner (analog PasskeyBezeichnung.java)
const UNERLAUBTE_BEZEICHNUNGSZEICHEN = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;

export function pruefePasskeyBezeichnung(eingabe: string): PasskeyBezeichnungPruefung {
  const bereinigt = eingabe.normalize('NFC').trim();

  if (bereinigt.length === 0) {
    return {
      gueltig: false,
      bereinigt,
      fehler: 'Bitte gib eine Bezeichnung für den Passkey ein.',
    };
  }

  if (bereinigt.length > PASSKEY_BEZEICHNUNG_MAX_LAENGE) {
    return {
      gueltig: false,
      bereinigt,
      fehler: `Die Bezeichnung darf höchstens ${PASSKEY_BEZEICHNUNG_MAX_LAENGE} Zeichen lang sein.`,
    };
  }

  if (UNERLAUBTE_BEZEICHNUNGSZEICHEN.test(bereinigt)) {
    return {
      gueltig: false,
      bereinigt,
      fehler: 'Die Bezeichnung darf keine Steuer- oder Formatzeichen enthalten.',
    };
  }

  return {
    gueltig: true,
    bereinigt,
    fehler: null,
  };
}
