import { useState } from 'react';
import {
  FieldError,
  Input,
  Label,
  Text,
  TextField as AriaTextField,
  type TextFieldProps as AriaTextFieldProps,
} from 'react-aria-components';
import './TextField.css';

export interface TextFieldProps extends Omit<AriaTextFieldProps, 'children' | 'className' | 'style'> {
  /** Sichtbares Label, zugleich zugänglicher Name des Eingabefelds. */
  label: string;
  /** Hilfetext unter dem Feld (wird per aria-describedby verknüpft). */
  description?: string;
  /** Fehlertext, sichtbar wenn `isInvalid` gesetzt ist oder die Validierung scheitert. */
  errorMessage?: string;
  className?: string;
}

/**
 * M3-Textfeld (Variante filled) auf Basis von React Aria. Label, Hilfetext und
 * Fehlertext sind mit dem Eingabefeld verknüpft. Das Label wandert nach oben,
 * sobald das Feld fokussiert ist oder einen Wert hat.
 */
export function TextField({
  label,
  description,
  errorMessage,
  className,
  value,
  defaultValue,
  onChange,
  ...rest
}: TextFieldProps) {
  const [eigenerWert, setEigenerWert] = useState(defaultValue ?? '');
  const aktuellerWert = value ?? eigenerWert;

  return (
    <AriaTextField
      {...rest}
      value={value}
      defaultValue={defaultValue}
      onChange={(neu) => {
        setEigenerWert(neu);
        onChange?.(neu);
      }}
      className={['md-text-field', className].filter(Boolean).join(' ')}
      data-gefuellt={aktuellerWert.length > 0 || undefined}
    >
      <div className="md-text-field__container">
        <Label className="md-text-field__label">{label}</Label>
        <Input className="md-text-field__input" />
      </div>
      {description && (
        <Text slot="description" className="md-text-field__supporting">
          {description}
        </Text>
      )}
      <FieldError className="md-text-field__supporting md-text-field__error">
        {errorMessage}
      </FieldError>
    </AriaTextField>
  );
}
