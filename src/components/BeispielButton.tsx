import { useState } from 'react';
import { Button } from 'react-aria-components';

/**
 * Beispielkomponente auf Basis von React Aria Components.
 * Zeigt, dass Tastatur-, Touch- und Zeigerbedienung über `onPress` laufen.
 * Wird durch die Komponentenbibliothek aus C-06 ersetzt.
 */
export function BeispielButton() {
  const [anzahl, setAnzahl] = useState(0);

  return (
    <div className="beispiel">
      <Button className="beispiel__button" onPress={() => setAnzahl((n) => n + 1)}>
        Antippen
      </Button>
      <p className="beispiel__status" role="status">
        {anzahl === 1 ? '1-mal angetippt' : `${anzahl}-mal angetippt`}
      </p>
    </div>
  );
}
