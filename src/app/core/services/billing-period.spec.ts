import { closingDate, parseBillingCycle, periodClosingIn, periodDatesError, periodOf, periodsBetween, withClosing, withPeriod } from './billing-period';

describe('billing periods', () => {
  const cycle = { closingDay: 19, closings: ['2026-08-19', '2026-09-17'] };

  it('should close on the usual day unless another date was given for that month', () => {
    expect(closingDate(cycle, '2026-10')).toBe('2026-10-19');
    expect(closingDate(cycle, '2026-09')).toBe('2026-09-17');
  });

  it('should close on the last day of months shorter than the usual day', () => {
    expect(closingDate({ closingDay: 31 }, '2026-02')).toBe('2026-02-28');
    expect(closingDate({ closingDay: 31 }, '2028-02')).toBe('2028-02-29');
    expect(closingDate({ closingDay: 31 }, '2026-04')).toBe('2026-04-30');
  });

  it('should start each period the day after the previous closing', () => {
    expect(periodClosingIn(cycle, '2026-09')).toEqual({ month: '2026-09', start: '2026-08-20', end: '2026-09-17' });
    expect(periodClosingIn(cycle, '2026-10')).toEqual({ month: '2026-10', start: '2026-09-18', end: '2026-10-19' });
    expect(periodClosingIn({ closingDay: 5 }, '2026-01')).toEqual({ month: '2026-01', start: '2025-12-06', end: '2026-01-05' });
  });

  it('should find the period a day is billed in', () => {
    expect(periodOf(cycle, '2026-09-17').month).toBe('2026-09');
    expect(periodOf(cycle, '2026-09-18').month).toBe('2026-10');
    expect(periodOf(cycle, '2026-08-20').month).toBe('2026-09');
    expect(periodOf({ closingDay: 20 }, '2026-12-25').month).toBe('2027-01');
  });

  it('should list the periods between two days, most recent first', () => {
    expect(periodsBetween(cycle, '2026-08-25', '2026-10-01').map(p => [p.start, p.end])).toEqual([
      ['2026-09-18', '2026-10-19'],
      ['2026-08-20', '2026-09-17'],
    ]);
    expect(periodsBetween(cycle, '2026-10-01', '2026-08-25')).toHaveLength(2);
    expect(periodsBetween(cycle, '2026-09-01', '2026-09-02')).toHaveLength(1);
  });

  it('should keep one closing per month, even on the usual day', () => {
    expect(withClosing(cycle, '2026-09-18')).toEqual({ closingDay: 19, closings: ['2026-08-19', '2026-09-18'] });
    expect(withClosing(cycle, '2026-07-21')).toEqual({ closingDay: 19, closings: ['2026-07-21', '2026-08-19', '2026-09-17'] });
    expect(withClosing({ closingDay: 19 }, '2026-09-19')).toEqual({ closingDay: 19, closings: ['2026-09-19'] });
  });

  it('should read stored cycles, dropping damaged closing dates', () => {
    expect(parseBillingCycle({ closingDay: 19, closings: ['2026-09-17', '2026-02-30', 'ayer', 7, '2026-09-18'] }))
      .toEqual({ closingDay: 19, closings: ['2026-09-18'] });
    expect(parseBillingCycle({ closingDay: 19 })).toEqual({ closingDay: 19 });
    expect(parseBillingCycle({ closingDay: 0 })).toBeUndefined();
    expect(parseBillingCycle({ closingDay: 19.5 })).toBeUndefined();
    expect(parseBillingCycle('19')).toBeUndefined();
    expect(parseBillingCycle(undefined)).toBeUndefined();
  });

  it('should set a whole period, moving the previous closing and keeping the due date', () => {
    const bci = { closingDay: 19, closings: ['2026-10-21'] };
    const edited = withPeriod(bci, '2026-10', { start: '2026-09-18', end: '2026-10-21', due: '2026-11-05' });
    expect(edited).toEqual({ closingDay: 19, closings: ['2026-09-17', '2026-10-21'], dueDates: { '2026-10': '2026-11-05' } });
    expect(periodClosingIn(edited, '2026-10')).toEqual({ month: '2026-10', start: '2026-09-18', end: '2026-10-21', due: '2026-11-05' });
    expect(periodClosingIn(edited, '2026-11').start).toBe('2026-10-22');

    const next = withPeriod(edited, '2026-11', { start: '2026-10-22', end: '2026-11-19' });
    expect(periodClosingIn(next, '2026-11')).toEqual({ month: '2026-11', start: '2026-10-22', end: '2026-11-19' });
    expect(periodClosingIn(next, '2026-10').due).toBe('2026-11-05');
    expect(withPeriod(next, '2026-10', { start: '2026-09-18', end: '2026-10-21', due: '' })).not.toHaveProperty('dueDates');
  });

  it('should refuse dates that cannot be the period closing in that month', () => {
    expect(periodDatesError('2026-10', { start: '2026-09-18', end: '2026-10-21' })).toBeNull();
    expect(periodDatesError('2026-10', { start: '2026-10-01', end: '2026-10-21' })).toBeNull();
    expect(periodDatesError('2026-10', { start: '2026-09-18', end: '2026-11-02' })).toContain('cierre');
    expect(periodDatesError('2026-10', { start: '2026-08-30', end: '2026-10-21' })).toContain('empezar');
    expect(periodDatesError('2026-10', { start: '2026-10-02', end: '2026-10-21' })).toContain('empezar');
    expect(periodDatesError('2026-10', { start: '', end: '2026-10-21' })).not.toBeNull();
    expect(periodDatesError('2026-10', { start: '2026-09-18', end: '2026-10-21', due: '2026-10-01' })).toContain('vencimiento');
    expect(() => withPeriod({ closingDay: 19 }, '2026-10', { start: '2026-10-25', end: '2026-10-21' })).toThrow();
  });

  it('should read stored due dates, dropping damaged ones', () => {
    expect(parseBillingCycle({ closingDay: 19, dueDates: { '2026-10': '2026-11-05', '2026-11': 'pronto', otro: '2026-11-05' } }))
      .toEqual({ closingDay: 19, dueDates: { '2026-10': '2026-11-05' } });
    expect(parseBillingCycle({ closingDay: 19, dueDates: ['2026-11-05'] })).toEqual({ closingDay: 19 });
  });
});
