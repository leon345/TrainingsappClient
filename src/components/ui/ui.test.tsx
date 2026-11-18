import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button, Card, ICON_NAMEN, Icon, IconButton, TextField } from '.';
import { iconPfad, pfadAusSvg } from './icons';

describe('Button', () => {
  it('löst onPress per Klick und Tastatur aus', async () => {
    const user = userEvent.setup();
    const onPress = vi.fn();
    render(<Button onPress={onPress}>Speichern</Button>);

    await user.tab();
    expect(screen.getByRole('button', { name: 'Speichern' })).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it('setzt Variante, Größe und Form als Datenattribute', () => {
    render(
      <Button variant="tonal" size="medium" shape="square">
        Weiter
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Weiter' });
    expect(button).toHaveAttribute('data-variant', 'tonal');
    expect(button).toHaveAttribute('data-size', 'medium');
    expect(button).toHaveAttribute('data-shape', 'square');
  });

  it('ist deaktiviert nicht bedienbar', async () => {
    const user = userEvent.setup();
    const onPress = vi.fn();
    render(
      <Button isDisabled onPress={onPress}>
        Löschen
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Löschen' });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('blendet das Icon für Screenreader aus', () => {
    render(<Button icon="play_arrow">Start</Button>);
    const svg = screen.getByRole('button', { name: 'Start' }).querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('IconButton', () => {
  it('ist über aria-label benannt', async () => {
    const user = userEvent.setup();
    const onPress = vi.fn();
    render(<IconButton icon="delete" aria-label="Löschen" onPress={onPress} />);
    await user.click(screen.getByRole('button', { name: 'Löschen' }));
    expect(onPress).toHaveBeenCalledOnce();
  });
});

describe('Icon', () => {
  it('hat für jeden Namen einen SVG-Pfad', () => {
    for (const name of ICON_NAMEN) {
      expect(iconPfad(name)).toMatch(/^[Mm]/);
    }
  });

  it('wirft bei SVG ohne Pfad', () => {
    expect(() => pfadAusSvg('<svg></svg>')).toThrow();
  });

  it('ist mit Label ein benanntes Bild', () => {
    render(<Icon name="timer" label="Timer" />);
    expect(screen.getByRole('img', { name: 'Timer' })).toBeInTheDocument();
  });
});

describe('Card', () => {
  it('rendert das gewählte Element', () => {
    render(
      <Card elementType="article" aria-label="Workout">
        Inhalt
      </Card>,
    );
    expect(screen.getByRole('article', { name: 'Workout' })).toHaveTextContent('Inhalt');
  });
});

describe('TextField', () => {
  it('verknüpft Label und Hilfetext mit dem Eingabefeld', () => {
    render(<TextField label="Titel" description="Höchstens 100 Zeichen" />);
    const eingabe = screen.getByRole('textbox', { name: 'Titel' });
    expect(eingabe).toHaveAccessibleDescription('Höchstens 100 Zeichen');
  });

  it('meldet Fehler zugänglich', () => {
    render(<TextField label="Notiz" isInvalid errorMessage="Zu lang" />);
    const eingabe = screen.getByRole('textbox', { name: 'Notiz' });
    expect(eingabe).toHaveAttribute('aria-invalid', 'true');
    expect(eingabe).toHaveAccessibleDescription('Zu lang');
  });

  it('markiert ein gefülltes Feld für das schwebende Label', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<TextField label="Name" onChange={onChange} />);
    const feld = container.querySelector('.md-text-field');
    expect(feld).not.toHaveAttribute('data-gefuellt');

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Lea');

    expect(onChange).toHaveBeenLastCalledWith('Lea');
    expect(feld).toHaveAttribute('data-gefuellt', 'true');
  });
});
