import { useId, type ReactNode } from 'react';
import { Switch as AriaSwitch, type SwitchProps as AriaSwitchProps } from 'react-aria-components';
import './Switch.css';

export interface SwitchProps extends Omit<AriaSwitchProps, 'children' | 'className' | 'style'> {
  /** Sichtbare Beschriftung, zugleich zugänglicher Name des Schalters. */
  label: string;
  /** Hinweis unter der Beschriftung, per aria-describedby mit dem Schalter verknüpft. */
  description?: ReactNode;
  className?: string;
}

/**
 * M3-Schalter (Switch) auf React Aria. Tastatur (Leertaste), Touch, Fokus und
 * `role="switch"` mit `aria-checked` kommen von React Aria. Beschriftung links,
 * Schalter rechts, Zeile mindestens 48 px hoch (Zielfläche). Ein Hinweis steht
 * darunter und ist per `aria-describedby` verknüpft.
 * Tokens: Compose `SwitchTokens` (siehe docs/design-tokens.md).
 */
export function Switch({ label, description, className, ...rest }: SwitchProps) {
  const hinweisId = useId();
  const schalter = (
    <AriaSwitch
      {...rest}
      aria-describedby={
        [rest['aria-describedby'], description ? hinweisId : undefined].filter(Boolean).join(' ') || undefined
      }
      className={['md-switch', description ? undefined : className].filter(Boolean).join(' ')}
    >
      <span className="md-switch__label">{label}</span>
      <span className="md-switch__spur" aria-hidden="true">
        <span className="md-switch__griff" />
      </span>
    </AriaSwitch>
  );
  if (!description) return schalter;
  // Hinweis außerhalb des <label>, sonst würde er Teil des zugänglichen Namens.
  return (
    <div className={['md-switch-feld', className].filter(Boolean).join(' ')}>
      {schalter}
      <span id={hinweisId} className="md-switch__hinweis">
        {description}
      </span>
    </div>
  );
}
