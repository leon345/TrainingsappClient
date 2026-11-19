import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { erstelleLeeresWorkoutFormular } from './formularLogik';
import { WorkoutFormular } from './WorkoutFormular';

describe('WorkoutFormular (Komponente)', () => {
  it('zeigt Validierungsfehler bei leerem Titel und leerem Satz', async () => {
    const user = userEvent.setup();
    const onAbsenden = vi.fn();

    render(
      <MemoryRouter>
        <WorkoutFormular
          initialZustand={erstelleLeeresWorkoutFormular(new Date(2026, 10, 19, 18, 0))}
          absendenLabel="Workout speichern"
          speichert={false}
          abbrechenZiel="/workouts"
          onAbsenden={onAbsenden}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Übung hinzufügen' }));
    await user.click(screen.getByRole('button', { name: 'Workout speichern' }));

    expect(onAbsenden).not.toHaveBeenCalled();
    expect(screen.getByText(/Bitte gib einen Titel für das Workout an/i)).toBeVisible();
    expect(screen.getByText(/Bitte gib einen Namen für die Übung an/i)).toBeVisible();
    expect(screen.getByText(/Bitte gib Wiederholungen oder Dauer/i)).toBeVisible();
  });

  it('erfasst Calisthenics-Workout mit Variante, Dauer-Vorschau, Uebungs-Sortierung und sendet API-Body', async () => {
    const user = userEvent.setup();
    const onAbsenden = vi.fn();

    render(
      <MemoryRouter>
        <WorkoutFormular
          initialZustand={erstelleLeeresWorkoutFormular(new Date(2026, 10, 19, 18, 30))}
          absendenLabel="Workout speichern"
          speichert={false}
          abbrechenZiel="/workouts"
          onAbsenden={onAbsenden}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Calisthenics' }));
    await user.type(screen.getByLabelText(/^Titel/i), 'Skill Session');
    await user.type(screen.getByLabelText(/Dauer \(Sekunden, optional\)/i), '2700');
    expect(screen.getByText('45:00')).toHaveAttribute('aria-label', '45 Minuten');

    await user.click(screen.getByRole('button', { name: 'Öffentlich' }));
    await user.type(screen.getByLabelText(/Notiz/i), 'Core war stark');

    // Erste Übung
    await user.click(screen.getByRole('button', { name: 'Übung hinzufügen' }));
    const uebung1Name = screen.getAllByLabelText(/^Übungsname/i)[0]!;
    const uebung1Variante = screen.getAllByLabelText(/Variante/i)[0]!;
    await user.type(uebung1Name, 'Front Lever');
    await user.type(uebung1Variante, 'Tuck');
    await user.type(screen.getAllByLabelText(/Dauer \(Sek\.\)/i)[0]!, '20');
    await user.type(screen.getAllByLabelText(/Pause \(Sek\.\)/i)[0]!, '90');

    expect(screen.getByText('00:20')).toHaveAttribute('aria-label', '20 Sekunden');
    expect(screen.getByText('01:30')).toHaveAttribute('aria-label', '1 Minute und 30 Sekunden');

    // Zweite Übung und nach oben verschieben
    await user.click(screen.getByRole('button', { name: 'Übung hinzufügen' }));
    const uebung2Name = screen.getAllByLabelText(/^Übungsname/i)[1]!;
    await user.type(uebung2Name, 'Klimmzüge');
    await user.type(screen.getAllByLabelText(/^Wiederholungen/i)[1]!, '8');
    await user.type(screen.getAllByLabelText(/Gewicht \(kg\)/i)[1]!, '12,5');

    await user.click(screen.getByRole('button', { name: 'Übung 2 nach oben verschieben' }));
    await user.click(screen.getByRole('button', { name: 'Workout speichern' }));

    expect(onAbsenden).toHaveBeenCalledTimes(1);
    const body = onAbsenden.mock.calls[0]?.[0];
    expect(body).toMatchObject({
      typ: 'CALISTHENICS',
      titel: 'Skill Session',
      dauerSekunden: 2700,
      notiz: 'Core war stark',
      sichtbarkeit: 'OEFFENTLICH',
      uebungen: [
        {
          name: 'Klimmzüge',
          saetze: [{ wiederholungen: 8, gewichtKg: 12.5 }],
        },
        {
          name: 'Front Lever',
          variante: 'Tuck',
          saetze: [{ dauerSekunden: 20, pauseSekunden: 90 }],
        },
      ],
    });
  });

  it('zeigt bei Versionskonflikt die Servermeldung und loest Neu laden aus', async () => {
    const user = userEvent.setup();
    const onNeuLaden = vi.fn();

    render(
      <MemoryRouter>
        <WorkoutFormular
          initialZustand={erstelleLeeresWorkoutFormular(new Date(2026, 10, 19, 18, 0))}
          absendenLabel="Änderungen speichern"
          speichert={false}
          serverFehler="Das Workout wurde zwischenzeitlich geändert."
          istVersionsKonflikt
          onNeuLaden={onNeuLaden}
          onAbsenden={vi.fn()}
        />
      </MemoryRouter>,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Das Workout wurde zwischenzeitlich geändert.');
    await user.click(within(alert).getByRole('button', { name: 'Neu laden' }));
    expect(onNeuLaden).toHaveBeenCalledTimes(1);
  });
});
