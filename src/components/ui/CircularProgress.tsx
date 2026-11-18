import type { CSSProperties, ReactNode } from 'react';
import { ProgressBar as AriaProgressBar } from 'react-aria-components';
import './CircularProgress.css';

export interface CircularProgressProps {
  /** Fortschritt 0 bis 100. */
  value: number;
  /** Zugänglicher Name, z. B. "Fortschritt der Phase". */
  'aria-label': string;
  /** Wert in Worten für Screenreader (`aria-valuetext`). Ohne Angabe: Prozent. */
  valueLabel?: string;
  /** Kantenlänge in px. Standard 40 (CircularProgressIndicatorTokens.Size). */
  size?: number;
  /** Dicke von Indikator und Spur in px. Standard 4 (Tokens). */
  thickness?: number;
  /**
   * Inhalt in der Mitte (z. B. die Restzeit). Liegt außerhalb des
   * `progressbar`-Elements, weil dessen Kinder für Screenreader nur
   * Darstellung sind; so bleibt etwa ein `role="timer"` erreichbar.
   */
  children?: ReactNode;
  className?: string;
}

/**
 * Kreisförmige Fortschrittsanzeige (bestimmt), M3 Expressive. Tokens aus
 * Compose CircularProgressIndicatorTokens: Dicke 4 dp, Abstand zwischen
 * Indikator und Spur 4 dp (TrackActiveSpace), Größe 40 dp; Farben aus
 * ProgressIndicatorDefaults: Indikator primary, Spur secondary-container;
 * runde Enden. Größere Anzeigen skalieren den Abstand mit der Dicke.
 * Rolle, Wert und Name kommen von React Aria (`role="progressbar"`).
 */
export function CircularProgress({
  value,
  valueLabel,
  size = 40,
  thickness = 4,
  children,
  className,
  ...rest
}: CircularProgressProps) {
  const anteil = Math.min(1, Math.max(0, value / 100));
  const radius = (size - thickness) / 2;
  const umfang = 2 * Math.PI * radius;
  const abstand = thickness;

  // Runde Enden ragen je halbe Dicke über die Strichlänge hinaus.
  const indikatorLaenge = Math.max(0, anteil * umfang - thickness);
  const spurStart = anteil * umfang + abstand + thickness / 2;
  const spurLaenge = umfang - abstand - thickness / 2 - spurStart;
  const zeigeIndikator = anteil > 0;
  const zeigeSpur = anteil === 0 || spurLaenge > 0;

  const mitte = size / 2;
  const stil = { '--_groesse': `${size}px` } as CSSProperties;

  return (
    <div className={['md-circular-progress', className].filter(Boolean).join(' ')} style={stil}>
      <AriaProgressBar
        {...rest}
        value={anteil * 100}
        valueLabel={valueLabel}
        className="md-circular-progress__balken"
      >
        <svg
          className="md-circular-progress__svg"
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
          aria-hidden="true"
          focusable="false"
        >
          {zeigeSpur && (
            <circle
              className="md-circular-progress__spur"
              cx={mitte}
              cy={mitte}
              r={radius}
              strokeWidth={thickness}
              {...(anteil > 0 && {
                strokeDasharray: `${spurLaenge} ${umfang}`,
                strokeDashoffset: -spurStart,
              })}
            />
          )}
          {zeigeIndikator && (
            <circle
              className="md-circular-progress__indikator"
              cx={mitte}
              cy={mitte}
              r={radius}
              strokeWidth={thickness}
              strokeDasharray={`${indikatorLaenge} ${umfang}`}
              strokeDashoffset={-thickness / 2}
            />
          )}
        </svg>
      </AriaProgressBar>
      {children !== undefined && <div className="md-circular-progress__inhalt">{children}</div>}
    </div>
  );
}
