import { describe, expect, it } from 'vitest';
import { formatiereTag } from './datum';

describe('formatiereTag', () => {
  it('YYYY-MM-DD wird TT.MM.JJJJ, ohne Zeitzonen-Verschiebung', () => {
    expect(formatiereTag('2026-11-01')).toBe('01.11.2026');
    expect(formatiereTag('2026-01-01')).toBe('01.01.2026');
    expect(formatiereTag('2025-12-31')).toBe('31.12.2025');
  });

  it('unlesbare Werte bleiben unverändert', () => {
    expect(formatiereTag('gestern')).toBe('gestern');
    expect(formatiereTag('2026-11-01T10:00:00Z')).toBe('2026-11-01T10:00:00Z');
  });
});
