import { describe, expect, it, vi } from 'vitest';
import { kombinierePhasenSignale, type PhasenSignal } from './phasenSignal';

describe('PhasenSignal-Port (phasenSignal.ts)', () => {
  it('leitet entsperren, ausloesen und freigeben weiter und isoliert Fehler einzelner Signale', () => {
    const kaputt: PhasenSignal = {
      entsperren: vi.fn(() => {
        throw new Error('Defekt');
      }),
      ausloesen: vi.fn(() => {
        throw new Error('Defekt');
      }),
      freigeben: vi.fn(() => {
        throw new Error('Defekt');
      }),
    };

    const funktionierend: PhasenSignal = {
      entsperren: vi.fn(),
      ausloesen: vi.fn(),
      freigeben: vi.fn(),
    };

    const kombiniert = kombinierePhasenSignale([kaputt, funktionierend]);

    expect(() => {
      kombiniert.entsperren?.();
      kombiniert.ausloesen('training');
      kombiniert.ausloesen('pause');
      kombiniert.freigeben?.();
    }).not.toThrow();

    expect(funktionierend.entsperren).toHaveBeenCalledTimes(1);
    expect(funktionierend.ausloesen).toHaveBeenNthCalledWith(1, 'training');
    expect(funktionierend.ausloesen).toHaveBeenNthCalledWith(2, 'pause');
    expect(funktionierend.freigeben).toHaveBeenCalledTimes(1);
  });
});
