import { Button as AriaButton, type ButtonProps as AriaButtonProps } from 'react-aria-components';
import { Icon } from './Icon';
import type { IconName } from './icons';
import './Button.css';
import './IconButton.css';

export type IconButtonVariante = 'standard' | 'filled' | 'tonal' | 'outlined';

export interface IconButtonProps
  extends Omit<AriaButtonProps, 'children' | 'className' | 'style' | 'aria-label'> {
  icon: IconName;
  /** Pflicht: zugänglicher Name, da der Button keinen sichtbaren Text hat. */
  'aria-label': string;
  variant?: IconButtonVariante;
  className?: string;
}

/** M3-Expressive-Icon-Button (Größe small, 40 px, Zielfläche 48 px). */
export function IconButton({ icon, variant = 'standard', className, ...rest }: IconButtonProps) {
  return (
    <AriaButton
      {...rest}
      className={['md-button', 'md-icon-button', className].filter(Boolean).join(' ')}
      data-variant={variant}
      data-shape="round"
    >
      <Icon name={icon} size={24} />
    </AriaButton>
  );
}
