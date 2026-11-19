import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { DatenschutzSeite, POC_HINWEIS_TEXT } from './DatenschutzSeite';

describe('DatenschutzSeite', () => {
  it('zeigt den vollstaendigen E31-PoC-Hinweis und alle DSGVO-Pflichtangaben', () => {
    render(
      <MemoryRouter>
        <DatenschutzSeite />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: /Datenschutz & PoC-Hinweis/i }),
    ).toBeVisible();
    expect(screen.getByText(POC_HINWEIS_TEXT)).toBeVisible();
    expect(
      screen.getByText('[Verantwortlicher / Impressum vom Betreiber einzutragen]'),
    ).toBeVisible();
    expect(screen.getByText(/Deutschland bei Strato/i)).toBeVisible();
    expect(
      screen.getByRole('heading', { name: /Passkey \(WebAuthn\)/i }),
    ).toBeVisible();
    expect(screen.getByText(/Server-Logs: 14 Tage/i)).toBeVisible();
    expect(screen.getByText(/Datenbank-Backups: 30 Tage/i)).toBeVisible();
    expect(screen.getByText(/Passkeylose Konten: 14 Tage/i)).toBeVisible();
    expect(screen.getByText(/JSON-Datenexport/i)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Zum Konto-Bereich' })).toHaveAttribute(
      'href',
      '/konto',
    );
  });
});
