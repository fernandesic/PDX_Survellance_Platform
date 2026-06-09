import { describe, it, expect } from 'vitest';
import { formatLastUpdated } from '../alertFeedUtils';

describe('formatLastUpdated', () => {
  const now = new Date('2026-04-22T12:00:00Z');

  it('returns "Never" when there has been no update', () => {
    expect(formatLastUpdated(null, now)).toBe('Never');
  });

  it('returns "Just now" for <5s (including slight clock drift into the future)', () => {
    expect(formatLastUpdated(new Date('2026-04-22T11:59:58Z'), now)).toBe('Just now');
    expect(formatLastUpdated(new Date('2026-04-22T12:00:03Z'), now)).toBe('Just now');
  });

  it('formats seconds and minutes', () => {
    expect(formatLastUpdated(new Date('2026-04-22T11:59:30Z'), now)).toBe('30s ago');
    expect(formatLastUpdated(new Date('2026-04-22T11:55:00Z'), now)).toBe('5m ago');
  });

  it('formats hours within the day', () => {
    expect(formatLastUpdated(new Date('2026-04-22T10:00:00Z'), now)).toBe('2h ago');
  });

  it('falls back to a locale datetime for >24h old', () => {
    const out = formatLastUpdated(new Date('2026-04-20T12:00:00Z'), now);
    expect(out).not.toMatch(/ago$/);
    expect(out).not.toBe('Never');
  });
});
