import type { HTMLAttributes, ReactNode } from 'react';
import './Card.css';

export type CardVariante = 'filled' | 'outlined';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  variant?: CardVariante;
  /** HTML-Element, passend zur Bedeutung (z. B. `article` für ein Workout, `li` in Listen). */
  elementType?: 'div' | 'section' | 'article' | 'li';
}

/**
 * M3-Card (nicht interaktiv). Tokens: FilledCardTokens, OutlinedCardTokens.
 * Eine anklickbare Card folgt bei Bedarf in einem Folgetask.
 */
export function Card({
  children,
  variant = 'filled',
  elementType: Element = 'div',
  className,
  ...rest
}: CardProps) {
  return (
    <Element
      {...rest}
      className={['md-card', className].filter(Boolean).join(' ')}
      data-variant={variant}
    >
      {children}
    </Element>
  );
}
