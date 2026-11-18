import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { BeispielButton } from './BeispielButton';

describe('BeispielButton', () => {
  it('zählt Klicks', async () => {
    const user = userEvent.setup();
    render(<BeispielButton />);

    await user.click(screen.getByRole('button', { name: 'Antippen' }));

    expect(screen.getByRole('status')).toHaveTextContent('1-mal angetippt');
  });

  it('ist per Tastatur bedienbar', async () => {
    const user = userEvent.setup();
    render(<BeispielButton />);

    await user.tab();
    expect(screen.getByRole('button', { name: 'Antippen' })).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');

    expect(screen.getByRole('status')).toHaveTextContent('2-mal angetippt');
  });
});
