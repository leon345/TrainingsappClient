import { useState } from 'react';
import { Button } from './ui';

/**
 * Beispielkomponente aus dem Grundgerüst, seit C-06 auf dem
 * M3-Button aus `components/ui`. Zeigt, dass Tastatur-, Touch- und
 * Zeigerbedienung über `onPress` laufen.
 */
export function BeispielButton() {
  const [anzahl, setAnzahl] = useState(0);

  return (
    <div className="beispiel">
      <Button variant="filled" onPress={() => setAnzahl((n) => n + 1)}>
        Antippen
      </Button>
      <p className="beispiel__status" role="status">
        {anzahl === 1 ? '1-mal angetippt' : `${anzahl}-mal angetippt`}
      </p>
    </div>
  );
}
