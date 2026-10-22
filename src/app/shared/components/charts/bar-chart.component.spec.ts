import { monthLabel } from './bar-chart.component';

describe('monthLabel', () => {
  it('should include the two-digit year', () => {
    expect(monthLabel('2025-01')).toBe('Ene 25');
    expect(monthLabel('2026-12')).toBe('Dic 26');
  });

  it('should tell the same month of different years apart', () => {
    expect(monthLabel('2025-01')).not.toBe(monthLabel('2026-01'));
  });

  it('should fall back to the raw key when the month is unknown', () => {
    expect(monthLabel('2025-13')).toBe('2025-13');
  });
});
