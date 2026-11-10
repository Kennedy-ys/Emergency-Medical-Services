import { describe, expect, it } from 'vitest';
import { distanceM, formatDistance, formatDuration } from './geo';

describe('geo', () => {
  it('measures roughly 111 km per degree of latitude', () => {
    const d = distanceM({ lat: 4, lng: 8 }, { lat: 5, lng: 8 });
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it('is zero for the same point', () => {
    expect(distanceM({ lat: 4.97, lng: 8.34 }, { lat: 4.97, lng: 8.34 })).toBe(0);
  });

  it('formats short distances in metres and long ones in kilometres', () => {
    expect(formatDistance(846)).toBe('850 m');
    expect(formatDistance(3210)).toBe('3.2 km');
  });

  it('never shows a zero-minute duration', () => {
    expect(formatDuration(5)).toBe('1 min');
    expect(formatDuration(601)).toBe('11 min');
  });
});
