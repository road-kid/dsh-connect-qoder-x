import { describe, expect, it } from 'vitest'
import { getClaimWindowDateString } from '../src/claim-window.ts'

/** An instant written as UTC+8 wall-clock, so the cases read as users see them. */
function utc8(iso: string): number {
  return new Date(`${iso}+08:00`).getTime()
}

/**
 * The plain UTC+8 CALENDAR date, computed here on purpose.
 *
 * The plugin no longer ships a calendar-date helper: nothing needed one once
 * the claim checks moved to the window. It survives in this test as the
 * counter-example that keeps the two notions from being merged by a later
 * refactor — the contrast IS the assertion.
 */
function calendarDayUtc8(ms: number): string {
  const d = new Date(ms)
  const u = new Date(d.getTime() + (d.getTimezoneOffset() + 480) * 60_000)
  return `${u.getFullYear()}-${String(u.getMonth() + 1).padStart(2, '0')}-${String(u.getDate()).padStart(2, '0')}`
}

describe('getClaimWindowDateString', () => {
  it('keeps the hours after midnight in the window that opened the day before', () => {
    // This is the reported bug, exactly. A benefit claimed at 23:11 belongs to
    // the window that opened at 10:00 that morning; at 00:44 the next calendar
    // day that window is STILL OPEN, so the claim must still count.
    const claimedAt = utc8('2026-09-30T23:11:00')
    const lookedAt = utc8('2026-10-01T00:44:00')
    expect(getClaimWindowDateString(claimedAt)).toBe('2026-09-30')
    expect(getClaimWindowDateString(lookedAt)).toBe('2026-09-30')
    expect(getClaimWindowDateString(claimedAt)).toBe(getClaimWindowDateString(lookedAt))
  })

  it('rolls to the next window exactly at the configured moment', () => {
    expect(getClaimWindowDateString(utc8('2026-09-30T09:59:59'))).toBe('2026-09-29')
    expect(getClaimWindowDateString(utc8('2026-09-30T10:00:00'))).toBe('2026-09-30')
    expect(getClaimWindowDateString(utc8('2026-09-30T23:59:59'))).toBe('2026-09-30')
    expect(getClaimWindowDateString(utc8('2026-10-01T09:59:59'))).toBe('2026-09-30')
    expect(getClaimWindowDateString(utc8('2026-10-01T10:00:00'))).toBe('2026-10-01')
  })

  it('follows a variant whose window opens at a custom moment', () => {
    // 14:30 (870): the 12:00 that follows a 10:00 opening belongs to yesterday.
    expect(getClaimWindowDateString(utc8('2026-09-30T12:00:00'), 870)).toBe('2026-09-29')
    expect(getClaimWindowDateString(utc8('2026-09-30T14:30:00'), 870)).toBe('2026-09-30')
  })

  it('differs from the calendar date only across the window boundary', () => {
    // Guards the distinction: the calendar day is still the right label for
    // WHEN something happened, so the two must not be quietly merged.
    const afterMidnight = utc8('2026-10-01T02:00:00')
    expect(calendarDayUtc8(afterMidnight)).toBe('2026-10-01')
    expect(getClaimWindowDateString(afterMidnight)).toBe('2026-09-30')
    // Mid-afternoon, they agree.
    const afternoon = utc8('2026-10-01T15:00:00')
    expect(calendarDayUtc8(afternoon)).toBe('2026-10-01')
    expect(getClaimWindowDateString(afternoon)).toBe('2026-10-01')
  })

  it('is not confused by the host timezone', () => {
    // The helper shifts to UTC+8 itself, so the same instant answers the same
    // window wherever the machine is. The suite runs at UTC+8 in CI only if we
    // assert the absolute instant, which is what the fixed ISO strings do.
    const sameInstant = Date.UTC(2026, 8, 30, 15, 11) // 23:11 UTC+8
    expect(getClaimWindowDateString(sameInstant)).toBe('2026-09-30')
  })
})
