import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button, CircularProgress, NumberField } from '.';

describe('Button large', () => {
  it('setzt die Größe und ein 32-px-Icon', () => {
    render(
      <Button size="large" icon="play_arrow">
        Start
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Start' });
    expect(button).toHaveAttribute('data-size', 'large');
    expect(button.querySelector('svg')).toHaveAttribute('width', '32');
  });
});

describe('NumberField', () => {
  it('ist über das Label benannt und mit dem Hilfetext verknüpft', () => {
    render(<NumberField label="Training in Sekunden" description="1 bis 86400" defaultValue={30} />);
    const feld = screen.getByRole('textbox', { name: 'Training in Sekunden' });
    expect(feld).toHaveValue('30');
    expect(feld).toHaveAccessibleDescription('1 bis 86400');
  });

  it('bietet die Ziffern-Tastatur an', () => {
    render(<NumberField label="Pause" minValue={0} defaultValue={10} />);
    expect(screen.getByRole('textbox', { name: 'Pause' })).toHaveAttribute('inputmode', 'numeric');
  });

  it('meldet den Wert erst beim Verlassen des Felds', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NumberField label="Training" defaultValue={30} minValue={1} maxValue={86400} onChange={onChange} />);
    const feld = screen.getByRole('textbox', { name: 'Training' });

    await user.clear(feld);
    await user.type(feld, '45');
    expect(onChange).not.toHaveBeenCalled();
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith(45);
  });

  it('begrenzt auf minValue und maxValue', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NumberField label="Training" defaultValue={30} minValue={1} maxValue={86400} onChange={onChange} />);
    const feld = screen.getByRole('textbox', { name: 'Training' });

    await user.clear(feld);
    await user.type(feld, '100000');
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith(86400);
    expect(feld).toHaveValue('86400');

    await user.clear(feld);
    await user.type(feld, '0');
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it('formatiert ohne Tausendertrennzeichen und ohne Nachkommastellen', async () => {
    const user = userEvent.setup();
    render(<NumberField label="Pause" defaultValue={86400} minValue={0} maxValue={86400} />);
    const feld = screen.getByRole('textbox', { name: 'Pause' });
    expect(feld).toHaveValue('86400');
    await user.clear(feld);
    // Dezimal- und Gruppentrenner werden bei ganzen Zahlen gar nicht angenommen.
    await user.type(feld, '1.2,7');
    await user.tab();
    expect(feld).toHaveValue('127');
  });

  it('Pfeiltasten ändern den Wert um 1', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NumberField label="Pause" defaultValue={10} minValue={0} onChange={onChange} />);
    await user.click(screen.getByRole('textbox', { name: 'Pause' }));
    await user.keyboard('{ArrowUp}');
    expect(onChange).toHaveBeenLastCalledWith(11);
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(onChange).toHaveBeenLastCalledWith(9);
  });

  it('meldet Fehler zugänglich', () => {
    render(<NumberField label="Training" isInvalid errorMessage="Bitte eine Zahl eingeben" />);
    const feld = screen.getByRole('textbox', { name: 'Training' });
    expect(feld).toHaveAttribute('aria-invalid', 'true');
    expect(feld).toHaveAccessibleDescription('Bitte eine Zahl eingeben');
  });

  it('lässt sich deaktivieren', () => {
    render(<NumberField label="Training" isDisabled defaultValue={30} />);
    expect(screen.getByRole('textbox', { name: 'Training' })).toBeDisabled();
  });
});

describe('CircularProgress', () => {
  it('ist ein benannter Fortschrittsbalken mit Wert und Werttext', () => {
    render(<CircularProgress value={25} aria-label="Fortschritt" valueLabel="noch 30 Sekunden" />);
    const balken = screen.getByRole('progressbar', { name: 'Fortschritt' });
    expect(balken).toHaveAttribute('aria-valuenow', '25');
    expect(balken).toHaveAttribute('aria-valuetext', 'noch 30 Sekunden');
  });

  it('begrenzt den Wert auf 0 bis 100', () => {
    const { rerender } = render(<CircularProgress value={140} aria-label="F" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    rerender(<CircularProgress value={-5} aria-label="F" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('zeigt bei 0 nur die Spur, bei 100 nur den Indikator', () => {
    const { container, rerender } = render(<CircularProgress value={0} aria-label="F" />);
    expect(container.querySelector('.md-circular-progress__indikator')).toBeNull();
    expect(container.querySelector('.md-circular-progress__spur')).not.toBeNull();
    rerender(<CircularProgress value={100} aria-label="F" />);
    expect(container.querySelector('.md-circular-progress__indikator')).not.toBeNull();
    expect(container.querySelector('.md-circular-progress__spur')).toBeNull();
    rerender(<CircularProgress value={50} aria-label="F" />);
    expect(container.querySelector('.md-circular-progress__indikator')).not.toBeNull();
    expect(container.querySelector('.md-circular-progress__spur')).not.toBeNull();
  });

  it('Inhalt in der Mitte liegt außerhalb des progressbar-Elements', () => {
    render(
      <CircularProgress value={10} aria-label="F">
        <div role="timer">00:30</div>
      </CircularProgress>,
    );
    const timer = screen.getByRole('timer');
    expect(screen.getByRole('progressbar').contains(timer)).toBe(false);
  });
});
