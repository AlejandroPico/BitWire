import { describe, expect, it } from 'vitest';
import { formatSI, parseSI, unitForProperty } from './si';

describe('engineering notation', () => {
  it('formats values with SI prefixes instead of long decimals', () => {
    expect(formatSI(15e-6,'F')).toBe('15 µF');
    expect(formatSI(4700,'Ω')).toBe('4.7 kΩ');
    expect(formatSI(2.2e-9,'F')).toBe('2.2 nF');
    expect(formatSI(-.012,'A')).toBe('-12 mA');
  });

  it('parses prefixes accepted by electronics notation', () => {
    expect(parseSI('15uF')).toBeCloseTo(15e-6,12);
    expect(parseSI('4,7 kΩ')).toBe(4700);
    expect(parseSI('2.2Meg')).toBe(2.2e6);
    expect(parseSI('invalid')).toBeUndefined();
  });

  it('maps editable electrical properties to their units', () => {
    expect(unitForProperty('resistance')).toBe('Ω');
    expect(unitForProperty('capacitance')).toBe('F');
    expect(unitForProperty('frequency')).toBe('Hz');
  });
});
