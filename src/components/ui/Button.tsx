import type { ReactNode, Ref } from 'react';
import { Button as AriaButton, type ButtonProps as AriaButtonProps } from 'react-aria-components';
import { Icon } from './Icon';
import type { IconName } from './icons';
import './Button.css';

export type ButtonVariante = 'filled' | 'tonal' | 'outlined' | 'text';
export type ButtonGroesse = 'small' | 'medium' | 'large';
export type ButtonForm = 'round' | 'square';

export interface ButtonProps extends Omit<AriaButtonProps, 'children' | 'className' | 'style'> {
  children: ReactNode;
  /** Betonung: filled (höchste) bis text (niedrigste). Standard: filled. */
  variant?: ButtonVariante;
  /** small = 40 px hoch (M3-Standard), medium = 56 px, large = 96 px (z. B. Start des Timers). */
  size?: ButtonGroesse;
  /** round = voll gerundet, square = Ecken nach Größe. Gedrückt morpht die Form (Expressive). */
  shape?: ButtonForm;
  /** Optionales führendes Icon (dekorativ, der Text benennt den Button). */
  icon?: IconName;
  className?: string;
  /** Zugriff auf das Button-Element, z. B. um den Fokus zu setzen (React 19: ref als Prop). */
  ref?: Ref<HTMLButtonElement>;
}

/** Icon-Größe je Button-Größe (ButtonSmall/Medium/LargeTokens). */
const ICON_GROESSE: Record<ButtonGroesse, number> = { small: 20, medium: 24, large: 32 };

/**
 * M3-Expressive-Button auf Basis von React Aria. Tastatur, Touch, Zeiger,
 * Fokus und Deaktivierung kommen von React Aria, das Aussehen aus den Tokens.
 */
export function Button({
  children,
  variant = 'filled',
  size = 'small',
  shape = 'round',
  icon,
  className,
  ...rest
}: ButtonProps) {
  return (
    <AriaButton
      {...rest}
      className={['md-button', className].filter(Boolean).join(' ')}
      data-variant={variant}
      data-size={size}
      data-shape={shape}
    >
      {icon && <Icon name={icon} size={ICON_GROESSE[size]} />}
      <span className="md-button__label">{children}</span>
    </AriaButton>
  );
}
