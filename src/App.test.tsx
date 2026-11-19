import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { App } from './App';

function renderApp(startPfad = '/') {
  return render(
    <MemoryRouter initialEntries={[startPfad]}>
      <App />
    </MemoryRouter>,
  );
}

describe('App-Navigation und Barrierefreiheit', () => {
  it('zeigt auf der Startseite den Intervalltimer sowie zentrale Landmark-Rollen', () => {
    renderApp('/');

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Hauptnavigation' })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Intervalltimer' })).toBeVisible();
    expect(screen.getByText('00:30')).toBeVisible();
  });

  it('navigiert zwischen allen Routen und haelt den Timer-Bereich im DOM gemountet', async () => {
    const user = userEvent.setup();
    renderApp('/');

    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' });
    const timerBereich = screen.getByTestId('timer-bereich');
    expect(timerBereich).not.toHaveAttribute('hidden');

    await user.click(within(nav).getByRole('link', { name: 'Workouts' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Workouts' })).toBeVisible();
    expect(timerBereich).toBeInTheDocument();
    expect(timerBereich).toHaveAttribute('hidden');

    await user.click(within(nav).getByRole('link', { name: 'Entdecken' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Entdecken' })).toBeVisible();

    await user.click(within(nav).getByRole('link', { name: 'Konto' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Konto' })).toBeVisible();

    await user.click(screen.getByRole('link', { name: /Datenschutz & PoC-Hinweis/i }));
    expect(
      screen.getByRole('heading', { level: 1, name: /Datenschutz & PoC-Hinweis/i }),
    ).toBeVisible();
    expect(
      within(screen.getByRole('main')).getByText(/vollständig KI-generiert/i),
    ).toBeVisible();

    await user.click(within(nav).getByRole('link', { name: 'Timer' }));
    expect(timerBereich).not.toHaveAttribute('hidden');
    expect(screen.getByRole('heading', { level: 1, name: 'Intervalltimer' })).toBeVisible();
  });

  it('leitet unbekannte Routen auf die Startseite weiter', () => {
    renderApp('/unbekannter-pfad');

    expect(screen.getByRole('heading', { level: 1, name: 'Intervalltimer' })).toBeVisible();
    expect(screen.getByTestId('timer-bereich')).not.toHaveAttribute('hidden');
  });
});
