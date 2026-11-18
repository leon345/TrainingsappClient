import type { ReactNode } from 'react';
import {
  FieldError,
  Input,
  Label,
  NumberField as AriaNumberField,
  Text,
  type NumberFieldProps as AriaNumberFieldProps,
} from 'react-aria-components';
import './TextField.css';
import './NumberField.css';

export interface NumberFieldProps
  extends Omit<AriaNumberFieldProps, 'children' | 'className' | 'style' | 'formatOptions'> {
  /** Sichtbares Label, zugleich zugänglicher Name des Eingabefelds. */
  label: string;
  /** Hilfetext unter dem Feld (per aria-describedby verknüpft). Darf Elemente enthalten. */
  description?: ReactNode;
  /** Fehlertext, sichtbar wenn `isInvalid` gesetzt ist oder die Validierung scheitert. */
  errorMessage?: string;
  className?: string;
}

/** Nur ganze Zahlen, ohne Tausendertrennzeichen, unabhängig von der Sprache des Browsers. */
const GANZZAHL: Intl.NumberFormatOptions = { maximumFractionDigits: 0, useGrouping: false };

/**
 * Zahlenfeld für ganze Zahlen, Aussehen wie das M3-Textfeld (filled).
 *
 * React Aria liefert Parsen, Pfeiltasten (±1), Bild-auf/-ab, die passende
 * Bildschirmtastatur (`inputmode`) und das Begrenzen auf `minValue`/`maxValue`
 * beim Verlassen des Felds. `onChange` meldet erst den übernommenen Wert
 * (Verlassen des Felds oder Eingabetaste); ein geleertes Feld meldet `NaN`.
 */
export function NumberField({ label, description, errorMessage, className, ...rest }: NumberFieldProps) {
  return (
    <AriaNumberField
      {...rest}
      formatOptions={GANZZAHL}
      className={['md-text-field', 'md-number-field', className].filter(Boolean).join(' ')}
    >
      {({ state }) => (
        <>
          <div className="md-text-field__container" data-gefuellt={state.inputValue !== '' || undefined}>
            <Label className="md-text-field__label">{label}</Label>
            <Input className="md-text-field__input" />
          </div>
          {description && (
            <Text slot="description" className="md-text-field__supporting">
              {description}
            </Text>
          )}
          <FieldError className="md-text-field__supporting md-text-field__error">{errorMessage}</FieldError>
        </>
      )}
    </AriaNumberField>
  );
}
