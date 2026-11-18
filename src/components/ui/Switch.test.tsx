import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Switch } from './Switch';

describe('Switch', () => {
  it('Rolle switch, Name aus der Beschriftung, Zustand per aria-checked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch label="Ton" defaultSelected onChange={onChange} />);
    const schalter = screen.getByRole('switch', { name: 'Ton' });
    expect(schalter).toBeChecked();

    await user.click(screen.getByText('Ton'));
    expect(schalter).not.toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it('per Tastatur: Tab fokussiert, Leertaste schaltet', async () => {
    const user = userEvent.setup();
    render(<Switch label="Vibration" />);
    await user.tab();
    const schalter = screen.getByRole('switch', { name: 'Vibration' });
    expect(schalter).toHaveFocus();
    await user.keyboard(' ');
    expect(schalter).toBeChecked();
  });

  it('Hinweis ist als Beschreibung verknüpft', () => {
    render(<Switch label="Vibration" description="Nicht verfügbar." />);
    expect(screen.getByRole('switch', { name: 'Vibration' })).toHaveAccessibleDescription('Nicht verfügbar.');
  });

  it('ohne Hinweis keine Beschreibung', () => {
    render(<Switch label="Ton" />);
    expect(screen.getByRole('switch', { name: 'Ton' })).not.toHaveAttribute('aria-describedby');
  });

  it('deaktiviert: nicht bedienbar', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Switch label="Vibration" isDisabled onChange={onChange} />);
    const schalter = screen.getByRole('switch', { name: 'Vibration' });
    expect(schalter).toBeDisabled();
    await user.click(screen.getByText('Vibration'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
