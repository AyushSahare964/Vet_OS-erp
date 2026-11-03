import { test, expect } from '@playwright/test';
import { draftEditableUntil, currentMonthStart } from '../src/lib/draftWindow';

// Pure logic, no app/DB needed. Times are IST (+05:30).
const ist = (s: string) => new Date(`${s}+05:30`).getTime();

test.describe('draft edit window = calendar month of creation', () => {
  test('draft saved on day 1 and day 28 both stay editable through the last day of the month', () => {
    for (const created of ['2026-10-01T00:00:00', '2026-10-28T15:00:00']) {
      const until = draftEditableUntil(ist(created));
      expect(until).toBe(ist('2026-10-31T23:59:59.999'));
      expect(ist('2026-10-31T23:59:59') <= until).toBe(true);
      expect(ist('2026-11-01T00:00:00') <= until).toBe(false);
    }
  });

  test('month lengths and leap February', () => {
    expect(draftEditableUntil(ist('2026-02-10T10:00:00'))).toBe(ist('2026-02-28T23:59:59.999'));
    expect(draftEditableUntil(ist('2028-02-10T10:00:00'))).toBe(ist('2028-02-29T23:59:59.999'));
    expect(draftEditableUntil(ist('2026-04-30T23:59:00'))).toBe(ist('2026-04-30T23:59:59.999'));
  });

  test('no year bleed: an Oct 2026 draft is locked in Oct 2027 and December rolls the year', () => {
    expect(ist('2027-10-15T10:00:00') <= draftEditableUntil(ist('2026-10-20T10:00:00'))).toBe(false);
    expect(draftEditableUntil(ist('2026-12-15T10:00:00'))).toBe(ist('2026-12-31T23:59:59.999'));
  });

  test('auto-save cutoff is the start of the current month', () => {
    expect(currentMonthStart(ist('2026-10-30T19:01:00'))).toBe(ist('2026-10-01T00:00:00'));
    expect(currentMonthStart(ist('2027-01-01T00:00:00'))).toBe(ist('2027-01-01T00:00:00'));
    const oct = ist('2026-10-31T22:00:00'); // created in Oct
    expect(oct < currentMonthStart(ist('2026-10-31T23:59:00'))).toBe(false); // still Oct: not swept
    expect(oct < currentMonthStart(ist('2026-11-01T00:01:00'))).toBe(true); // Nov: swept
  });
});
