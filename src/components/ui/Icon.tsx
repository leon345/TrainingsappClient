import { ICON_VIEWBOX, iconPfad, type IconName } from './icons';
import './Icon.css';

export interface IconProps {
  name: IconName;
  /** Kantenlänge in px. Standard 24 (M3-Icon-Größe). */
  size?: number;
  /**
   * Zugänglicher Name. Ohne Label ist das Icon dekorativ und für
   * Screenreader ausgeblendet; dann muss das umgebende Element benannt sein.
   */
  label?: string;
  className?: string;
}

/** Icon aus Material Symbols Rounded, Farbe folgt `currentColor`. */
export function Icon({ name, size = 24, label, className }: IconProps) {
  return (
    <svg
      className={['md-icon', className].filter(Boolean).join(' ')}
      viewBox={ICON_VIEWBOX}
      width={size}
      height={size}
      fill="currentColor"
      focusable="false"
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <path d={iconPfad(name)} />
    </svg>
  );
}
