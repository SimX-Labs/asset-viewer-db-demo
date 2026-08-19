import { formatDateTime, isDateTimeString } from './datetime.util';

describe('datetime.util', () => {
  it('recognizes ISO timestamps and plain dates only', () => {
    expect(isDateTimeString('2026-02-11T19:37:55.123Z')).toBeTrue();
    expect(isDateTimeString('2026-02-11T19:37:55')).toBeTrue();
    expect(isDateTimeString('2026-02-11 19:37')).toBeTrue();
    expect(isDateTimeString('2026-02-11')).toBeTrue();
    expect(isDateTimeString('custom_vessel/Snack Cart-112232')).toBeFalse();
    expect(isDateTimeString(20260211)).toBeFalse();
    expect(isDateTimeString(null)).toBeFalse();
  });

  it('drops seconds and milliseconds', () => {
    const formatted = formatDateTime('2026-02-11T19:37:55.123Z');
    expect(formatted).not.toContain('55');
    expect(formatted).not.toContain('123');
    expect(formatted).toContain('2026');
  });

  it('keeps a bare date on its own calendar day', () => {
    expect(formatDateTime('2026-02-11')).toBe(
      new Date(2026, 1, 11).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
    );
  });

  it('renders local wall-clock time to the minute', () => {
    const local = '2026-02-11T19:37:55';
    expect(formatDateTime(local)).toBe(
      new Date(2026, 1, 11, 19, 37).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }),
    );
  });

  it('passes through values it cannot parse', () => {
    expect(formatDateTime('not-a-date')).toBe('not-a-date');
    expect(formatDateTime('2026-13-45T99:99:99Z')).toBe('2026-13-45T99:99:99Z');
  });
});
